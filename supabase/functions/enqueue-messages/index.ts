// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This is a Deno edge function, not a Node.js file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { detectCarrier, getTrackingUrl } from "../_shared/carrier-utils.ts";
import { validateApiKey, validateJWT, validateJobOwnership, handleCorsOptions, corsHeaders } from "../_shared/api-key-validator.ts";

interface MessageRow {
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
  priority?: number;
}

interface EnqueueRequest {
  jobId: string;
  rows: MessageRow[];
  senderName?: string;
  autoProcess?: boolean; // If true, start processing immediately
}

interface QueueInsertRow {
  job_id: string;
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
  sender_name: string;
  priority: number;
  status: "PENDING";
  carrier?: string;
  tracking_url?: string;
}

function normalizeRows(rows: MessageRow[]): {
  normalizedRows: MessageRow[];
  duplicatesSkipped: number;
  invalidRowsSkipped: number;
} {
  const seen = new Set<string>();
  const normalizedRows: MessageRow[] = [];
  let duplicatesSkipped = 0;
  let invalidRowsSkipped = 0;

  for (const row of rows) {
    const phone = row.phone_e164?.trim();
    const guideNumber = row.guide_number?.trim();
    const recipientName = row.recipient_name?.trim();

    if (!phone || !guideNumber || !recipientName) {
      invalidRowsSkipped++;
      continue;
    }

    const uniqueKey = `${phone}|${guideNumber}`;
    if (seen.has(uniqueKey)) {
      duplicatesSkipped++;
      continue;
    }
    seen.add(uniqueKey);

    normalizedRows.push({
      phone_e164: phone,
      guide_number: guideNumber,
      recipient_name: recipientName,
      priority: typeof row.priority === "number" ? row.priority : 5,
    });
  }

  return { normalizedRows, duplicatesSkipped, invalidRowsSkipped };
}

function buildQueueMessages(
  jobId: string,
  rows: MessageRow[],
  senderName: string,
  includeCarrierFields = true
): QueueInsertRow[] {
  return rows.map((row) => {
    const carrierInfo = detectCarrier(row.guide_number);
    const trackingUrl = getTrackingUrl(row.guide_number, carrierInfo);

    const baseRow: QueueInsertRow = {
      job_id: jobId,
      phone_e164: row.phone_e164,
      guide_number: row.guide_number,
      recipient_name: row.recipient_name,
      sender_name: senderName,
      priority: row.priority || 5,
      status: "PENDING",
    };

    if (!includeCarrierFields) {
      return baseRow;
    }

    return {
      ...baseRow,
      carrier: carrierInfo?.carrier || "servientrega",
      tracking_url: trackingUrl,
    };
  });
}

function mapInsertErrorToUserMessage(rawError: string): string {
  const error = rawError.toLowerCase();

  if (
    error.includes("on conflict do update command cannot affect row a second time") ||
    error.includes("cannot affect row a second time")
  ) {
    return "El archivo tiene filas repetidas con el mismo teléfono y guía. Corrija duplicados e intente de nuevo.";
  }

  if (error.includes('column "carrier"') || error.includes('column "tracking_url"')) {
    return "La base de datos está desactualizada. Ejecute las migraciones pendientes e intente de nuevo.";
  }

  if (error.includes("no unique or exclusion constraint matching the on conflict specification")) {
    return "Falta la restricción única de la cola en la base de datos. Ejecute las migraciones pendientes e intente de nuevo.";
  }

  return "No se pudo encolar los mensajes. Intente de nuevo.";
}

async function markJobAsFailedEnqueue(
  supabaseClient: ReturnType<typeof createClient>,
  jobId: string | null | undefined,
  reason: string
) {
  if (!jobId) {
    return;
  }

  const { error } = await supabaseClient
    .from("jobs")
    .update({ status: "FAILED_ENQUEUE" })
    .eq("id", jobId);

  if (error) {
    console.error(`Failed to mark job ${jobId} as FAILED_ENQUEUE (${reason}):`, error);
  } else {
    console.warn(`Job ${jobId} marked as FAILED_ENQUEUE (${reason}).`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsOptions();
  }

  // Validate API Key
  const apiKeyValidation = validateApiKey(req);
  if (apiKeyValidation !== true) {
    return apiKeyValidation; // Return error response
  }

  // Validate JWT and get user
  const jwtValidation = await validateJWT(req);
  if (!("user" in jwtValidation)) {
    return jwtValidation; // Return error response
  }
  const { user } = jwtValidation;

  let jobIdForFailure: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseKey);

    const senderNameEnv = Deno.env.get("SENDER_NAME") || "Import Corporal Medical";
    
    const { jobId, rows, senderName, autoProcess } = (await req.json()) as EnqueueRequest;
    jobIdForFailure = jobId || null;

    if (!jobId) {
      return new Response(
        JSON.stringify({
          error: "Missing jobId or rows",
          message: "Faltan datos del envío (job o filas). Recargue la página e intente de nuevo.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user owns the job
    const ownershipValidation = await validateJobOwnership(jobId, user.id);
    if (ownershipValidation !== true) {
      return ownershipValidation; // Return error response
    }

    if (!rows?.length) {
      await markJobAsFailedEnqueue(supabase, jobId, "missing_rows");
      return new Response(
        JSON.stringify({
          error: "Missing rows",
          message: "No se encontraron filas para encolar. El envío quedó marcado como FALLIDO_ENCOLADO.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalSenderName = senderName || senderNameEnv;

    // Normalize rows and remove duplicated keys in the same payload
    const { normalizedRows, duplicatesSkipped, invalidRowsSkipped } = normalizeRows(rows);

    if (!normalizedRows.length) {
      await markJobAsFailedEnqueue(supabase, jobId, "no_valid_rows_after_normalization");
      return new Response(
        JSON.stringify({
          error: "No valid rows to enqueue",
          message: "No hay filas válidas para encolar. El envío quedó marcado como FALLIDO_ENCOLADO.",
          duplicatesSkipped,
          invalidRowsSkipped,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into queue (upsert to handle duplicates already existing in DB)
    const queueMessagesWithCarrier = buildQueueMessages(jobId, normalizedRows, finalSenderName, true);
    let { error: insertError } = await supabase
      .from("message_queue")
      .upsert(queueMessagesWithCarrier, {
        onConflict: "job_id,phone_e164,guide_number",
        ignoreDuplicates: false,
      });

    // Backward compatibility: retry if old schema does not have optional carrier fields yet
    if (insertError && (insertError.message.includes('column "carrier"') || insertError.message.includes('column "tracking_url"'))) {
      console.warn("message_queue schema without carrier/tracking_url detected. Retrying upsert without optional fields.");
      const queueMessagesWithoutCarrier = buildQueueMessages(jobId, normalizedRows, finalSenderName, false);
      const fallbackUpsert = await supabase
        .from("message_queue")
        .upsert(queueMessagesWithoutCarrier, {
          onConflict: "job_id,phone_e164,guide_number",
          ignoreDuplicates: false,
        });
      insertError = fallbackUpsert.error;
    }

    if (insertError) {
      await markJobAsFailedEnqueue(supabase, jobId, `queue_upsert_error:${insertError.message}`);
      return new Response(
        JSON.stringify({
          error: insertError.message,
          message: mapInsertErrorToUserMessage(insertError.message),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job status
    await supabase
      .from("jobs")
      .update({ status: "QUEUED" })
      .eq("id", jobId);

    // If autoProcess is true, trigger processing
    let processResult = null;
    let processTriggerError: string | null = null;
    if (autoProcess) {
      let triggerTimeoutId: number | undefined;
      try {
        const triggerTimeoutMs = Number(Deno.env.get("AUTO_PROCESS_TRIGGER_TIMEOUT_MS") || "3500");
        const controller = new AbortController();
        triggerTimeoutId = setTimeout(() => controller.abort(), triggerTimeoutMs);
        const userAuthorization = req.headers.get("authorization");
        const internalApiKey = Deno.env.get("API_KEY");

        if (!userAuthorization || !internalApiKey) {
          processTriggerError = "No se pudo iniciar el envío automático por credenciales internas faltantes. Use 'Procesar cola' en el detalle del envío.";
        } else {
          const processResponse = await fetch(
            `${supabaseUrl}/functions/v1/process-message-queue`,
            {
              method: "POST",
              headers: {
                Authorization: userAuthorization,
                "X-API-Key": internalApiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ jobId }),
              signal: controller.signal,
            }
          );

          if (processResponse.ok) {
            processResult = await processResponse.json().catch(() => null);
          } else {
            const errBody = await processResponse.json().catch(() => ({}));
            processTriggerError = errBody?.message || errBody?.error || "Error al iniciar el procesamiento";
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          // Trigger request took too long; don't block enqueue response.
          processTriggerError = "El procesamiento automático tardó en responder. Use 'Procesar cola' en el detalle del envío.";
        } else {
          console.error("Failed to trigger auto-processing:", error);
          processTriggerError = "No se pudo iniciar el envío automático. Use 'Procesar cola' en el detalle del envío.";
        }
      } finally {
        if (triggerTimeoutId) {
          clearTimeout(triggerTimeoutId);
        }
      }
    }

    return new Response(
      JSON.stringify({
        enqueued: normalizedRows.length,
        received: rows.length,
        duplicatesSkipped,
        invalidRowsSkipped,
        jobId,
        status: autoProcess ? "processing" : "queued",
        processResult,
        processTriggerError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error enqueuing messages:", err);
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await markJobAsFailedEnqueue(
          supabase,
          jobIdForFailure,
          `unexpected_exception:${(err as Error).message}`
        );
      }
    } catch (markError) {
      console.error("Failed to mark FAILED_ENQUEUE in catch block:", markError);
    }
    const msg = (err as Error).message;
    return new Response(
      JSON.stringify({
        error: msg,
        message: msg.includes("ownership") || msg.includes("Job")
          ? "No tiene permiso para este envío o el trabajo no existe."
          : "Error al encolar mensajes. Intente de nuevo.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

