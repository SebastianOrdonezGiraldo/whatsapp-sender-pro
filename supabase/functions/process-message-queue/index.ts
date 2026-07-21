// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This is a Deno edge function, not a Node.js file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import nodemailer from "npm:nodemailer@7.0.10";
import { detectCarrier, getCarrierConfig, getTrackingUrl, type Carrier } from "../_shared/carrier-utils.ts";
import { EMAIL_LOGO_BASE64, EMAIL_LOGO_CID } from "../_shared/email-logo.ts";
import { buildGuideEmailContent } from "../_shared/email-utils.ts";
import { computeNextRetryAt } from "../_shared/retry-utils.ts";
import {
  calculateDelayPerMessage,
  normalizeRateLimitConfig,
  resolveBatchLimit,
  resolveRequestedMaxMessages,
  type RateLimitConfig,
} from "../_shared/process-queue-utils.ts";
import { validateApiKey, validateJWT, validateJobOwnership, handleCorsOptions, corsHeaders } from "../_shared/api-key-validator.ts";
import { getWhatsAppFriendlyMessage } from "../_shared/wa-error-messages.ts";

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
  recipient_email?: string | null;
  email_status?: "NOT_REQUESTED" | "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  email_message_id?: string | null;
  email_error_message?: string | null;
  email_sent_at?: string | null;
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
  email_pending?: number;
  email_processing?: number;
  email_sent?: number;
  email_failed?: number;
  email_total?: number;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  replyTo?: string;
}

interface EmailDeliveryResult {
  status: "NOT_REQUESTED" | "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  messageId: string | null;
  error: string | null;
  sentAt: string | null;
}

function getSmtpConfig(): { config: SmtpConfig | null; error: string | null } {
  const user = Deno.env.get("SMTP_USER")?.trim();
  const password = Deno.env.get("SMTP_PASSWORD");

  if (!user || !password) {
    return {
      config: null,
      error: "SMTP no configurado. Defina SMTP_USER y SMTP_PASSWORD en los secretos de Supabase.",
    };
  }

  const port = Number(Deno.env.get("SMTP_PORT") || "465");
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { config: null, error: "SMTP_PORT no es válido." };
  }

  return {
    config: {
      host: Deno.env.get("SMTP_HOST")?.trim() || "smtp.hostinger.com",
      port,
      secure: (Deno.env.get("SMTP_SECURE") || (port === 465 ? "true" : "false")).toLowerCase() === "true",
      user,
      password,
      from: Deno.env.get("SMTP_FROM")?.trim() || user,
      fromName: Deno.env.get("SMTP_FROM_NAME")?.trim() || Deno.env.get("SENDER_NAME") || "Import Corporal Medical",
      replyTo: Deno.env.get("SMTP_REPLY_TO")?.trim() || undefined,
    },
    error: null,
  };
}

async function sendGuideEmail(
  message: QueueMessage,
  smtpConfig: SmtpConfig | null,
  smtpConfigError: string | null
): Promise<EmailDeliveryResult> {
  if (!message.recipient_email) {
    return { status: "NOT_REQUESTED", messageId: null, error: null, sentAt: null };
  }

  if (!smtpConfig) {
    return {
      status: "FAILED",
      messageId: null,
      error: smtpConfigError || "SMTP no configurado.",
      sentAt: null,
    };
  }

  try {
    const carrierInfo = message.carrier
      ? getCarrierConfig(message.carrier)
      : detectCarrier(message.guide_number);
    // Rebuild this server-side instead of trusting the persisted URL, which can
    // be edited through the user-scoped queue API.
    const trackingUrl = getTrackingUrl(message.guide_number, carrierInfo);
    const content = buildGuideEmailContent({
      recipientName: message.recipient_name,
      guideNumber: message.guide_number,
      carrierName: carrierInfo?.displayName || "Transportadora",
      trackingUrl,
      senderName: message.sender_name,
    });
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      requireTLS: !smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.password,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
    const info = await transporter.sendMail({
      from: { name: smtpConfig.fromName, address: smtpConfig.from },
      to: message.recipient_email,
      replyTo: smtpConfig.replyTo,
      subject: content.subject,
      text: content.text,
      html: content.html,
      attachments: [{
        filename: "import-corporal-medical-logo.jpg",
        content: EMAIL_LOGO_BASE64,
        encoding: "base64",
        contentType: "image/jpeg",
        contentDisposition: "inline",
        cid: EMAIL_LOGO_CID,
      }],
    });

    return {
      status: "SENT",
      messageId: info.messageId || null,
      error: null,
      sentAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`SMTP delivery failed for queue message ${message.id}:`, error);
    return {
      status: "FAILED",
      messageId: null,
      error: `No se pudo enviar el correo: ${(error as Error).message}`,
      sentAt: null,
    };
  }
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

    const { config: smtpConfig, error: smtpConfigError } = getSmtpConfig();

    const deliverPendingEmail = async (message: QueueMessage): Promise<EmailDeliveryResult> => {
      if (!message.recipient_email) {
        return { status: "NOT_REQUESTED", messageId: null, error: null, sentAt: null };
      }

      if (message.email_status !== "PENDING") {
        return {
          status: message.email_status || "FAILED",
          messageId: message.email_message_id || null,
          error: message.email_error_message || null,
          sentAt: message.email_sent_at || null,
        };
      }

      const { data: claimedEmailRows, error: claimEmailError } = await supabase
        .from("message_queue")
        .update({ email_status: "PROCESSING", email_error_message: null })
        .eq("id", message.id)
        .eq("email_status", "PENDING")
        .select("id")
        .limit(1);

      if (claimEmailError) {
        console.error(`Failed to claim email for queue message ${message.id}:`, claimEmailError);
        return {
          status: "FAILED",
          messageId: null,
          error: "No se pudo reservar el envío del correo.",
          sentAt: null,
        };
      }

      if (!claimedEmailRows?.length) {
        return {
          status: message.email_status || "PROCESSING",
          messageId: message.email_message_id || null,
          error: message.email_error_message || null,
          sentAt: message.email_sent_at || null,
        };
      }

      const delivery = await sendGuideEmail(message, smtpConfig, smtpConfigError);
      const { error: emailUpdateError } = await supabase
        .from("message_queue")
        .update({
          email_status: delivery.status,
          email_message_id: delivery.messageId,
          email_error_message: delivery.error,
          email_sent_at: delivery.sentAt,
        })
        .eq("id", message.id);

      if (emailUpdateError) {
        console.error(`Failed to persist email result for queue message ${message.id}:`, emailUpdateError);
      }

      return delivery;
    };

    // Get rate limit configuration
    const { data: rateLimitConfig } = await supabase
      .from("rate_limit_config")
      .select("*")
      .limit(1)
      .single();

    const config: RateLimitConfig = normalizeRateLimitConfig(rateLimitConfig);

    const { jobId, maxMessages } = (await req.json().catch(() => ({}))) as ProcessRequest;
    const nowIso = new Date().toISOString();
    const processingStaleMs = Number(Deno.env.get("PROCESSING_STALE_MS") || "300000");
    let recoveredStaleProcessing = 0;
    let recoveredStaleEmailProcessing = 0;
    const userIsAdmin = user.app_metadata?.role === "admin";

    const syncJobFromQueue = async (targetJobId: string): Promise<QueueStats | null> => {
      const { data: queueStatsData, error: queueStatsError } = await supabase.rpc("get_job_queue_stats", {
        job_uuid: targetJobId,
      });

      if (queueStatsError || !queueStatsData) {
        console.error(`Failed to load queue stats for job ${targetJobId}:`, queueStatsError);
        return null;
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

      return queueStats;
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

      const { data: recoveredEmailRows, error: recoverEmailError } = await supabase
        .from("message_queue")
        .update({
          email_status: "PENDING",
          email_error_message: "Correo recuperado automáticamente tras quedar atascado en PROCESSING.",
        })
        .eq("job_id", jobId)
        .eq("email_status", "PROCESSING")
        .lt("updated_at", staleCutoffIso)
        .select("id");

      if (recoverEmailError) {
        console.error(`Failed to recover stale email rows for job ${jobId}:`, recoverEmailError);
      } else {
        recoveredStaleEmailProcessing = recoveredEmailRows?.length ?? 0;
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

    // Processing loop budget
    const processLoopMaxRuntimeMs = Number(Deno.env.get("PROCESS_LOOP_MAX_RUNTIME_MS") || "25000");
    const processStartedAt = Date.now();
    const requestedMaxMessages = resolveRequestedMaxMessages(maxMessages);
    let remainingRequestedMessages = requestedMaxMessages;

    const baseQueueQuery = () => {
      let q = supabase
        .from("message_queue")
        .select("*, jobs!inner(user_id)")
        .order("priority", { ascending: true })
        .order("scheduled_at", { ascending: true });

      // Admin can process other users' jobs only when a specific job is requested.
      if (!userIsAdmin || !jobId) {
        q = q.eq("jobs.user_id", user.id);
      }

      if (jobId) {
        q = q.eq("job_id", jobId);
      }

      return q;
    };

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let retrying = 0;
    let skippedAlreadyClaimed = 0;
    let fetchedAtLeastOneMessage = false;
    let emailsSent = 0;
    let emailsFailed = 0;

    // Calculate delay between messages to respect rate limit
    const delayPerMessage = calculateDelayPerMessage(config);

    while (Date.now() - processStartedAt < processLoopMaxRuntimeMs) {
      if (remainingRequestedMessages !== null && remainingRequestedMessages <= 0) {
        break;
      }

      const batchLimit = resolveBatchLimit(config.batch_size, remainingRequestedMessages);

      if (batchLimit <= 0) {
        break;
      }

      const { data: pendingMessages, error: pendingError } = await baseQueueQuery()
        .eq("status", "PENDING")
        .limit(batchLimit);

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

      if (messages.length < batchLimit) {
        const remaining = batchLimit - messages.length;
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
        break;
      }

      fetchedAtLeastOneMessage = true;
      console.log(`Processing batch of ${messages.length} messages...`);

      for (const message of messages) {
        if (Date.now() - processStartedAt >= processLoopMaxRuntimeMs) {
          break;
        }

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

        const emailDelivery = await deliverPendingEmail(message);
        if (emailDelivery.status === "SENT" && message.email_status === "PENDING") {
          emailsSent++;
        } else if (emailDelivery.status === "FAILED" && message.email_status === "PENDING") {
          emailsFailed++;
        }

        processed++;
        if (remainingRequestedMessages !== null) {
          remainingRequestedMessages = Math.max(0, remainingRequestedMessages - 1);
        }

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
              recipient_email: message.recipient_email || null,
              sender_name: message.sender_name,
              template_name: waTemplateName,
              wa_message_id: result.messageId,
              status: "SENT",
              error_message: null,
              email_status: emailDelivery.status,
              email_message_id: emailDelivery.messageId,
              email_error_message: emailDelivery.error,
              email_sent_at: emailDelivery.sentAt,
            },
            { onConflict: "job_id,phone_e164,guide_number" }
          );

          sent++;
        } else {
          // Check if we should retry
          const shouldRetry = message.retry_count < message.max_retries;

          if (shouldRetry) {
            // Calculate next retry time with exponential backoff
            const nextRetryAt = computeNextRetryAt(
              Date.now(),
              message.retry_count,
              config.retry_delay_base_ms,
              config.retry_delay_max_ms
            );

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
                recipient_email: message.recipient_email || null,
                sender_name: message.sender_name,
                template_name: waTemplateName,
                wa_message_id: null,
                status: "FAILED",
                error_message: result.error,
                email_status: emailDelivery.status,
                email_message_id: emailDelivery.messageId,
                email_error_message: emailDelivery.error,
                email_sent_at: emailDelivery.sentAt,
              },
              { onConflict: "job_id,phone_e164,guide_number" }
            );

            failed++;
          }
        }

        // Rate limiting delay
        if (Date.now() - processStartedAt < processLoopMaxRuntimeMs) {
          await new Promise((resolve) => setTimeout(resolve, delayPerMessage));
        }
      }
    }

    // Process email-only retries without resetting the WhatsApp status. This avoids
    // resending an already delivered WhatsApp notification when only SMTP failed.
    let emailOnlyProcessed = 0;
    while (Date.now() - processStartedAt < processLoopMaxRuntimeMs) {
      const emailBatchLimit = resolveBatchLimit(config.batch_size, null);
      const { data: pendingEmailMessages, error: pendingEmailError } = await baseQueueQuery()
        .eq("email_status", "PENDING")
        .in("status", ["SENT", "FAILED"])
        .limit(emailBatchLimit);

      if (pendingEmailError) {
        console.error("Failed to load pending email deliveries:", pendingEmailError);
        break;
      }

      if (!pendingEmailMessages?.length) {
        break;
      }

      for (const message of pendingEmailMessages) {
        if (Date.now() - processStartedAt >= processLoopMaxRuntimeMs) {
          break;
        }

        const emailDelivery = await deliverPendingEmail(message);
        emailOnlyProcessed++;

        if (emailDelivery.status === "SENT") {
          emailsSent++;
        } else if (emailDelivery.status === "FAILED") {
          emailsFailed++;
        }

        const { error: sentMessageEmailUpdateError } = await supabase
          .from("sent_messages")
          .update({
            recipient_email: message.recipient_email || null,
            email_status: emailDelivery.status,
            email_message_id: emailDelivery.messageId,
            email_error_message: emailDelivery.error,
            email_sent_at: emailDelivery.sentAt,
          })
          .eq("job_id", message.job_id)
          .eq("phone_e164", message.phone_e164)
          .eq("guide_number", message.guide_number);

        if (sentMessageEmailUpdateError) {
          console.error(`Failed to sync email result to sent_messages for ${message.id}:`, sentMessageEmailUpdateError);
        }
      }
    }

    const runtimeBudgetReached = Date.now() - processStartedAt >= processLoopMaxRuntimeMs;

    // Update job statistics if jobId was specified
    let queueStats: QueueStats | null = null;
    if (jobId) {
      queueStats = await syncJobFromQueue(jobId);
    }

    const hasMorePending = queueStats
      ? queueStats.pending > 0 || queueStats.retrying > 0 || queueStats.processing > 0
      : false;
    const hasMoreEmailPending = queueStats
      ? (queueStats.email_pending || 0) > 0 || (queueStats.email_processing || 0) > 0
      : false;

    return new Response(
      JSON.stringify({
        processed,
        sent,
        failed,
        retrying,
        skippedAlreadyClaimed,
        recoveredStaleProcessing,
        recoveredStaleEmailProcessing,
        emailsSent,
        emailsFailed,
        emailOnlyProcessed,
        queueStats,
        hasMorePending,
        hasMoreEmailPending,
        runtimeBudgetReached,
        requestedLimitReached: remainingRequestedMessages !== null && remainingRequestedMessages <= 0,
        message: fetchedAtLeastOneMessage
          ? `Processed ${processed} messages: ${sent} sent, ${failed} failed, ${retrying} retrying; emails: ${emailsSent} sent, ${emailsFailed} failed`
          : emailOnlyProcessed > 0
          ? `Processed ${emailOnlyProcessed} pending email deliveries: ${emailsSent} sent, ${emailsFailed} failed`
          : "No pending messages",
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

