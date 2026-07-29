// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This is a Deno edge function, not a Node.js file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { validateApiKey, validateJWT, validateJobOwnership, handleCorsOptions, corsHeaders } from "../_shared/api-key-validator.ts";
import {
  buildQueueMessages,
  mapInsertErrorToUserMessage,
  normalizeRows,
  type MessageRow,
} from "../_shared/enqueue-utils.ts";
import {
  markJobAsFailedEnqueue,
  upsertQueueWithSchemaFallback,
} from "../_shared/enqueue-flow-utils.ts";
import { triggerProcessQueueContinuation } from "../_shared/queue-continuation-utils.ts";

interface EnqueueRequest {
  jobId: string;
  rows: MessageRow[];
  senderName?: string;
  autoProcess?: boolean; // If true, start processing immediately
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
    const { normalizedRows, duplicatesSkipped, invalidRowsSkipped, invalidEmailsSkipped } = normalizeRows(rows);

    if (!normalizedRows.length) {
      await markJobAsFailedEnqueue(supabase, jobId, "no_valid_rows_after_normalization");
      return new Response(
        JSON.stringify({
          error: "No valid rows to enqueue",
          message: "No hay filas válidas para encolar. El envío quedó marcado como FALLIDO_ENCOLADO.",
          duplicatesSkipped,
          invalidRowsSkipped,
          invalidEmailsSkipped,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into queue (upsert to handle duplicates already existing in DB)
    const queueMessagesWithCarrier = buildQueueMessages(jobId, normalizedRows, finalSenderName, true);
    const queueMessagesWithoutCarrier = buildQueueMessages(jobId, normalizedRows, finalSenderName, false);
    const queueUpsertResult = await upsertQueueWithSchemaFallback({
      upsertWithCarrier: async () =>
        supabase
          .from("message_queue")
          .upsert(queueMessagesWithCarrier, {
            onConflict: "job_id,phone_e164,guide_number",
            ignoreDuplicates: false,
          }),
      upsertWithoutCarrier: async () =>
        supabase
          .from("message_queue")
          .upsert(queueMessagesWithoutCarrier, {
            onConflict: "job_id,phone_e164,guide_number",
            ignoreDuplicates: false,
          }),
    });

    if (queueUpsertResult.fallbackUsed) {
      console.warn("message_queue schema without carrier/tracking_url detected. Retrying upsert without optional fields.");
    }

    if (queueUpsertResult.errorMessage) {
      await markJobAsFailedEnqueue(supabase, jobId, `queue_upsert_error:${queueUpsertResult.errorMessage}`);
      return new Response(
        JSON.stringify({
          error: queueUpsertResult.errorMessage,
          message: mapInsertErrorToUserMessage(queueUpsertResult.errorMessage),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update job status
    await supabase
      .from("jobs")
      .update({ status: "QUEUED" })
      .eq("id", jobId);

    // If autoProcess is true, kick off processing without waiting for the full drain.
    // process-message-queue self-chains while work remains.
    let processResult = null;
    let processTriggerError: string | null = null;
    let processTriggerScheduled = false;
    if (autoProcess) {
      const userAuthorization = req.headers.get("authorization");
      const internalApiKey = Deno.env.get("API_KEY");

      if (!userAuthorization || !internalApiKey) {
        processTriggerError =
          "No se pudo iniciar el envío automático por credenciales internas faltantes. Use 'Procesar cola' en el detalle del envío.";
      } else {
        const triggerResult = triggerProcessQueueContinuation({
          supabaseUrl,
          authorization: userAuthorization,
          apiKey: internalApiKey,
          jobId,
          continueDepth: 0,
          delayMs: 0,
        });
        processTriggerScheduled = triggerResult.scheduled;
        if (!triggerResult.scheduled) {
          processTriggerError =
            "No se pudo iniciar el envío automático. Use 'Procesar cola' en el detalle del envío.";
        }
      }
    }

    return new Response(
      JSON.stringify({
        enqueued: normalizedRows.length,
        received: rows.length,
        duplicatesSkipped,
        invalidRowsSkipped,
        invalidEmailsSkipped,
        jobId,
        status: autoProcess ? "processing" : "queued",
        processResult,
        processTriggerError,
        processTriggerScheduled,
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

