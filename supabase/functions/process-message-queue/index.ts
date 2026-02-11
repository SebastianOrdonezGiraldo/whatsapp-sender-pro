// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This is a Deno edge function, not a Node.js file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
}

interface ProcessRequest {
  jobId?: string; // Optional: process specific job, or all pending if omitted
  maxMessages?: number; // Optional: limit number of messages to process
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

// Send WhatsApp message via Graph API
async function sendWhatsAppMessage(
  message: QueueMessage,
  waToken: string,
  waPhoneId: string,
  waTemplateName: string,
  waTemplateLang: string,
  waGraphVersion: string
): Promise<{ success: boolean; messageId?: string; error?: string; errorCode?: string }> {
  try {
    const url = `https://graph.facebook.com/${waGraphVersion}/${waPhoneId}/messages`;
    const body = {
      messaging_product: "whatsapp",
      to: message.phone_e164.replace("+", ""),
      type: "template",
      template: {
        name: waTemplateName,
        language: { code: waTemplateLang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: message.recipient_name },
              { type: "text", text: message.sender_name },
              { type: "text", text: message.guide_number },
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

    const waData = await waRes.json();

    if (waRes.ok && waData.messages?.[0]?.id) {
      return { success: true, messageId: waData.messages[0].id };
    } else {
      return {
        success: false,
        error: waData.error?.message || JSON.stringify(waData),
        errorCode: waData.error?.code?.toString() || "UNKNOWN",
      };
    }
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
      errorCode: "NETWORK_ERROR",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Extract authorization token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token for authentication
    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        JSON.stringify({ error: "WhatsApp credentials not configured" }),
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

    // Build query for pending messages
    let query = supabase
      .from("message_queue")
      .select("*")
      .in("status", ["PENDING", "RETRYING"])
      .order("priority", { ascending: true })
      .order("scheduled_at", { ascending: true });

    // Filter by job if specified
    if (jobId) {
      // Verify user owns this job
      const { data: job } = await supabase
        .from("jobs")
        .select("user_id")
        .eq("id", jobId)
        .single();

      if (!job || job.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Job not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      query = query.eq("job_id", jobId);
    } else {
      // Only process messages from user's jobs
      const { data: userJobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("user_id", user.id);

      if (!userJobs || userJobs.length === 0) {
        return new Response(
          JSON.stringify({ processed: 0, message: "No jobs found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      query = query.in("job_id", userJobs.map(j => j.id));
    }

    // Limit batch size
    const limit = maxMessages ? Math.min(maxMessages, config.batch_size) : config.batch_size;
    query = query.limit(limit);

    const { data: messages, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch messages: ${fetchError.message}`);
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending messages" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${messages.length} messages...`);

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let retrying = 0;

    // Calculate delay between messages to respect rate limit
    const delayPerMessage = Math.max(
      1000 / config.messages_per_second,
      config.batch_delay_ms / config.batch_size
    );

    for (const message of messages) {
      // Mark as processing
      await supabase
        .from("message_queue")
        .update({
          status: "PROCESSING",
          processing_started_at: new Date().toISOString(),
        })
        .eq("id", message.id);

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
          { onConflict: "phone_e164,guide_number" }
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
            { onConflict: "phone_e164,guide_number" }
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
      const { data: queueStats } = await supabase.rpc("get_job_queue_stats", {
        job_uuid: jobId,
      });

      if (queueStats) {
        const allProcessed = queueStats.pending === 0 && queueStats.retrying === 0;
        await supabase
          .from("jobs")
          .update({
            sent_ok: queueStats.sent,
            sent_failed: queueStats.failed,
            status: allProcessed ? "COMPLETED" : "PROCESSING",
          })
          .eq("id", jobId);
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        sent,
        failed,
        retrying,
        message: `Processed ${processed} messages: ${sent} sent, ${failed} failed, ${retrying} retrying`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error processing queue:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

