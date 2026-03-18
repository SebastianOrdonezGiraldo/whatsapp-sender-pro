// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This is a Deno edge function, not a Node.js file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { detectCarrier, getCarrierConfig, type Carrier } from "../_shared/carrier-utils.ts";
import { validateApiKey, validateJWT, validateJobOwnership, handleCorsOptions, corsHeaders } from "../_shared/api-key-validator.ts";
import { getWhatsAppFriendlyMessage } from "../_shared/wa-error-messages.ts";

interface RateLimitConfig {
  messages_per_second: number;
  messages_per_minute: number;
  messages_per_hour: number;
  batch_size: number;
  batch_delay_ms: number;
  retry_delay_base_ms: number;
  retry_delay_max_ms: number;
  error_threshold: number;
  circuit_break_duration_ms: number;
}

interface QueueMessage {
  id: string;
  job_id: string;
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
  sender_name: string;
  retry_count: number;
  max_retries: number;
  carrier?: Carrier;
  tracking_url?: string;
}

interface ProcessRequest {
  jobId?: string; // Optional: process specific job, or all pending if omitted
  maxMessages?: number; // Optional: limit number of messages to process
}

interface QueueStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  retrying: number;
  total: number;
}

// Calculate exponential backoff delay
function calculateBackoffDelay(
  retryCount: number,
  baseMs: number,
  maxMs: number
): number {
  const delay = baseMs * Math.pow(2, retryCount);
  return Math.min(delay, maxMs);
}

// Send WhatsApp message via Graph API with carrier-specific template
async function sendWhatsAppMessage(
  message: QueueMessage,
  waToken: string,
  waPhoneId: string,
  defaultTemplateName: string,
  waTemplateLang: string,
  waGraphVersion: string
): Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: string }> {
  try {
    // Detect carrier and get correct template
    const carrierInfo = message.carrier 
      ? getCarrierConfig(message.carrier)
      : detectCarrier(message.guide_number);
    
    // Use carrier-specific template or fall back to default
    const templateName = carrierInfo?.templateName || defaultTemplateName;
    const cleanGuideNumber = message.guide_number.replace(/\D/g, '');
    
    const url = `https://graph.facebook.com/${waGraphVersion}/${waPhoneId}/messages`;
    
    // Template structure for Import Corporal Medical:
    // Body: {{1}} = Nombre destinatario, {{2}} = Número de guía, {{3}} = Estado de envío
    // Button: Static URL (no variables)
    // Note: Transportadora is hardcoded in each template text, not a variable
    
    const body = {
      messaging_product: "whatsapp",
      to: message.phone_e164.replace("+", ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: waTemplateLang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: message.recipient_name }, // {{1}} Nombre del destinatario
              { type: "text", text: cleanGuideNumber }, // {{2}} Número de guía
              { type: "text", text: "Guia creada" }, // {{3}} Estado de envío
            ],
          },
        ],
      },
    };

    const waRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${waToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let waData: { messages?: { id: string }[]; error?: { message?: string; code?: number } };
    try {
      const text = await waRes.text();
      waData = text ? JSON.parse(text) : {};
    } catch {
      return {
        success: false,
        error: "Respuesta inválida de WhatsApp",
        errorCode: "PARSE_ERROR",
      };
    }

    if (waRes.ok && waData.messages?.[0]?.id) {
      return { success: true, messageId: waData.messages[0].id };
    }

    const errorCode = waData.error?.code?.toString() || "UNKNOWN";
    const rawError = waData.error?.message || JSON.stringify(waData);
    const friendlyMessage = getWhatsAppFriendlyMessage(errorCode, rawError);

    return {
      success: false,
      error: friendlyMessage,
      errorCode,
    };
  } catch (err) {
    const errorCode = "NETWORK_ERROR";
    const rawError = (err as Error).message;
    const friendlyMessage = getWhatsAppFriendlyMessage(errorCode, rawError);
    return {
      success: false,
      error: friendlyMessage,
      errorCode,
    };
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseKey);

    // WhatsApp configuration
    const waToken = Deno.env.get("WA_TOKEN");
    const waPhoneId = Deno.env.get("WA_PHONE_NUMBER_ID");
    const waTemplateName = Deno.env.get("WA_TEMPLATE_NAME") || "shipment_notification";
    const waTemplateLang = Deno.env.get("WA_TEMPLATE_LANG") || "es_CO";
    const waGraphVersion = Deno.env.get("WA_GRAPH_VERSION") || "v19.0";

    if (!waToken || !waPhoneId) {
      return new Response(
        JSON.stringify({
          error: "WhatsApp credentials not configured",
          message: "Credenciales de WhatsApp no configuradas. Contacte al administrador.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get rate limit configuration
    const { data: rateLimitConfig } = await supabase
      .from("rate_limit_config")
      .select("*")
      .limit(1)
      .single();

    const config: RateLimitConfig = rateLimitConfig || {
      messages_per_second: 80,
      batch_size: 20,
      batch_delay_ms: 250,
      retry_delay_base_ms: 1000,
      retry_delay_max_ms: 60000,
    };

    const { jobId, maxMessages } = (await req.json().catch(() => ({}))) as ProcessRequest;
    const nowIso = new Date().toISOString();
    const processingStaleMs = Number(Deno.env.get("PROCESSING_STALE_MS") || "300000");
    let recoveredStaleProcessing = 0;

    const syncJobFromQueue = async (targetJobId: string) => {
      const { data: queueStatsData, error: queueStatsError } = await supabase.rpc("get_job_queue_stats", {
        job_uuid: targetJobId,
      });

      if (queueStatsError || !queueStatsData) {
        console.error(`Failed to load queue stats for job ${targetJobId}:`, queueStatsError);
        return;
      }

      const queueStats = queueStatsData as QueueStats;
      const allProcessed =
        queueStats.pending === 0 &&
        queueStats.retrying === 0 &&
        queueStats.processing === 0;

      const { error: updateJobError } = await supabase
        .from("jobs")
        .update({
          sent_ok: queueStats.sent,
          sent_failed: queueStats.failed,
          status: allProcessed ? "COMPLETED" : "PROCESSING",
        })
        .eq("id", targetJobId);

      if (updateJobError) {
        console.error(`Failed to sync job ${targetJobId} from queue stats:`, updateJobError);
      }
    };

    // If jobId is specified, validate ownership
    if (jobId) {
      const ownershipValidation = await validateJobOwnership(jobId, user.id);
      if (ownershipValidation !== true) {
        return ownershipValidation; // Return error response
      }
    }

    // Recover stale PROCESSING rows for this job (crashed worker / timeout scenario).
    if (jobId) {
      const staleCutoffIso = new Date(Date.now() - processingStaleMs).toISOString();
      const { data: recoveredRows, error: recoverError } = await supabase
        .from("message_queue")
        .update({
          status: "RETRYING",
          next_retry_at: nowIso,
          processing_started_at: null,
          error_message: "Mensaje recuperado automáticamente tras quedar atascado en PROCESSING.",
          error_code: "STALE_PROCESSING_RECOVERY",
        })
        .eq("job_id", jobId)
        .eq("status", "PROCESSING")
        .lt("processing_started_at", staleCutoffIso)
        .select("id");

      if (recoverError) {
        console.error(`Failed to recover stale PROCESSING rows for job ${jobId}:`, recoverError);
      } else {
        recoveredStaleProcessing = recoveredRows?.length ?? 0;
      }
    }

    // Filter by specific job if specified
    if (jobId) {
      // Verify job exists
      const { data: job } = await supabase
        .from("jobs")
        .select("id")
        .eq("id", jobId)
        .single();

      if (!job) {
        return new Response(
          JSON.stringify({ error: "Job not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Limit batch size
    const limit = maxMessages ? Math.min(maxMessages, config.batch_size) : config.batch_size;
    const baseQueueQuery = () => {
      let q = supabase
        .from("message_queue")
        .select("*, jobs!inner(user_id)")
        .eq("jobs.user_id", user.id)
        .order("priority", { ascending: true })
        .order("scheduled_at", { ascending: true });

      if (jobId) {
        q = q.eq("job_id", jobId);
      }

      return q;
    };

    const { data: pendingMessages, error: pendingError } = await baseQueueQuery()
      .eq("status", "PENDING")
      .limit(limit);

    if (pendingError) {
      return new Response(
        JSON.stringify({
          error: pendingError.message,
          message: "No se pudieron cargar los mensajes de la cola. Intente de nuevo.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages = [...(pendingMessages ?? [])];

    if (messages.length < limit) {
      const remaining = limit - messages.length;
      const { data: retryDueMessages, error: retryFetchError } = await baseQueueQuery()
        .eq("status", "RETRYING")
        .lte("next_retry_at", nowIso)
        .limit(remaining);

      if (retryFetchError) {
        return new Response(
          JSON.stringify({
            error: retryFetchError.message,
            message: "No se pudieron cargar los reintentos pendientes de la cola. Intente de nuevo.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      messages.push(...(retryDueMessages ?? []));
    }

    if (!messages || messages.length === 0) {
      if (jobId) {
        await syncJobFromQueue(jobId);
      }
      return new Response(
        JSON.stringify({
          processed: 0,
          recoveredStaleProcessing,
          message: "No pending messages",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${messages.length} messages...`);

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let retrying = 0;
    let skippedAlreadyClaimed = 0;

    // Calculate delay between messages to respect rate limit
    const delayPerMessage = Math.max(
      1000 / config.messages_per_second,
      config.batch_delay_ms / config.batch_size
    );

    for (const message of messages) {
      // Claim message atomically to avoid duplicate processing in concurrent workers.
      const { data: claimedRows, error: claimError } = await supabase
        .from("message_queue")
        .update({
          status: "PROCESSING",
          processing_started_at: new Date().toISOString(),
        })
        .eq("id", message.id)
        .in("status", ["PENDING", "RETRYING"])
        .select("id")
        .limit(1);

      if (claimError) {
        console.error(`Failed to claim message ${message.id}:`, claimError);
        continue;
      }

      if (!claimedRows || claimedRows.length === 0) {
        skippedAlreadyClaimed++;
        continue;
      }

      // Send message
      const result = await sendWhatsAppMessage(
        message,
        waToken,
        waPhoneId,
        waTemplateName,
        waTemplateLang,
        waGraphVersion
      );

      processed++;

      if (result.success) {
        // Mark as sent
        await supabase
          .from("message_queue")
          .update({
            status: "SENT",
            wa_message_id: result.messageId,
            processed_at: new Date().toISOString(),
          })
          .eq("id", message.id);

        // Also update sent_messages table
        await supabase.from("sent_messages").upsert(
          {
            job_id: message.job_id,
            phone_e164: message.phone_e164,
            guide_number: message.guide_number,
            recipient_name: message.recipient_name,
            sender_name: message.sender_name,
            template_name: waTemplateName,
            wa_message_id: result.messageId,
            status: "SENT",
            error_message: null,
          },
          { onConflict: "job_id,phone_e164,guide_number" }
        );

        sent++;
      } else {
        // Check if we should retry
        const shouldRetry = message.retry_count < message.max_retries;

        if (shouldRetry) {
          // Calculate next retry time with exponential backoff
          const backoffMs = calculateBackoffDelay(
            message.retry_count,
            config.retry_delay_base_ms,
            config.retry_delay_max_ms
          );
          const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

          await supabase
            .from("message_queue")
            .update({
              status: "RETRYING",
              retry_count: message.retry_count + 1,
              next_retry_at: nextRetryAt,
              error_message: result.error,
              error_code: result.errorCode,
              processed_at: new Date().toISOString(),
            })
            .eq("id", message.id);

          retrying++;
        } else {
          // Max retries reached, mark as failed
          await supabase
            .from("message_queue")
            .update({
              status: "FAILED",
              error_message: result.error,
              error_code: result.errorCode,
              processed_at: new Date().toISOString(),
            })
            .eq("id", message.id);

          // Also update sent_messages table
          await supabase.from("sent_messages").upsert(
            {
              job_id: message.job_id,
              phone_e164: message.phone_e164,
              guide_number: message.guide_number,
              recipient_name: message.recipient_name,
              sender_name: message.sender_name,
              template_name: waTemplateName,
              wa_message_id: null,
              status: "FAILED",
              error_message: result.error,
            },
            { onConflict: "job_id,phone_e164,guide_number" }
          );

          failed++;
        }
      }

      // Rate limiting delay
      if (processed < messages.length) {
        await new Promise((resolve) => setTimeout(resolve, delayPerMessage));
      }
    }

    // Update job statistics if jobId was specified
    if (jobId) {
      await syncJobFromQueue(jobId);
    }

    return new Response(
      JSON.stringify({
        processed,
        sent,
        failed,
        retrying,
        skippedAlreadyClaimed,
        recoveredStaleProcessing,
        message: `Processed ${processed} messages: ${sent} sent, ${failed} failed, ${retrying} retrying, ${skippedAlreadyClaimed} skipped (claimed by another worker), ${recoveredStaleProcessing} stale recovered`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error processing queue:", err);
    const msg = (err as Error).message;
    return new Response(
      JSON.stringify({
        error: msg,
        message: msg.includes("credentials") ? "Error de credenciales. Contacte al administrador." : "Error al procesar la cola. Intente de nuevo.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

