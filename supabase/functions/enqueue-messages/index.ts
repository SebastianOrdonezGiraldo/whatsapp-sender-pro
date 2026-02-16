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

    const senderNameEnv = Deno.env.get("SENDER_NAME") || "Import Corporal Medical";
    
    const { jobId, rows, senderName, autoProcess } = (await req.json()) as EnqueueRequest;

    if (!jobId || !rows?.length) {
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
      return new Response(
        JSON.stringify({
          error: insertError.message,
          message: "No se pudo encolar los mensajes. Intente de nuevo.",
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
      try {
        const processResponse = await fetch(
          `${supabaseUrl}/functions/v1/process-message-queue`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ jobId }),
          }
        );

        if (processResponse.ok) {
          processResult = await processResponse.json();
        } else {
          const errBody = await processResponse.json().catch(() => ({}));
          processTriggerError = errBody?.message || errBody?.error || "Error al iniciar el procesamiento";
        }
      } catch (error) {
        console.error("Failed to trigger auto-processing:", error);
        processTriggerError = "No se pudo iniciar el envío automático. Use 'Procesar cola' en el detalle del envío.";
      }
    }

    return new Response(
      JSON.stringify({
        enqueued: rows.length,
        jobId,
        status: autoProcess ? "processing" : "queued",
        processResult,
        processTriggerError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error enqueuing messages:", err);
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

