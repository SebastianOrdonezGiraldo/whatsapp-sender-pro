// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - This is a Deno edge function, not a Node.js file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { detectCarrier, getTrackingUrl } from "../_shared/carrier-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = `Bearer ${supabaseKey}`;

    // Create service role client for database operations (no authentication required)
    const supabase = createClient(supabaseUrl, supabaseKey);

    const senderNameEnv = Deno.env.get("SENDER_NAME") || "Import Corporal Medical";
    
    const { jobId, rows, senderName, autoProcess } = (await req.json()) as EnqueueRequest;

    if (!jobId || !rows?.length) {
      return new Response(
        JSON.stringify({ error: "Missing jobId or rows" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify job exists (no authentication required)
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalSenderName = senderName || senderNameEnv;

    // Prepare messages for queue with carrier detection
    const queueMessages = rows.map((row) => {
      const carrierInfo = detectCarrier(row.guide_number);
      const trackingUrl = getTrackingUrl(row.guide_number, carrierInfo);
      
      return {
        job_id: jobId,
        phone_e164: row.phone_e164,
        guide_number: row.guide_number,
        recipient_name: row.recipient_name,
        sender_name: finalSenderName,
        carrier: carrierInfo?.carrier || 'servientrega', // default to servientrega
        tracking_url: trackingUrl,
        priority: row.priority || 5,
        status: "PENDING",
      };
    });

    // Insert into queue (upsert to handle duplicates)
    const { error: insertError } = await supabase
      .from("message_queue")
      .upsert(queueMessages, {
        onConflict: "job_id,phone_e164,guide_number",
        ignoreDuplicates: false,
      });

    if (insertError) {
      throw new Error(`Failed to enqueue messages: ${insertError.message}`);
    }

    // Update job status
    await supabase
      .from("jobs")
      .update({ status: "QUEUED" })
      .eq("id", jobId);

    // If autoProcess is true, trigger processing
    let processResult = null;
    if (autoProcess) {
      try {
        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/process-message-queue`,
          {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ jobId }),
          }
        );

        if (processResponse.ok) {
          processResult = await processResponse.json();
        }
      } catch (error) {
        console.error("Failed to trigger auto-processing:", error);
        // Don't fail the request if auto-processing fails
      }
    }

    return new Response(
      JSON.stringify({
        enqueued: rows.length,
        jobId,
        status: autoProcess ? "processing" : "queued",
        processResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error enqueuing messages:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

