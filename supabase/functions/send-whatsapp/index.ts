import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MessageRow {
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const waToken = Deno.env.get("WA_TOKEN");
    const waPhoneId = Deno.env.get("WA_PHONE_NUMBER_ID");
    const waTemplateName = Deno.env.get("WA_TEMPLATE_NAME") || "shipment_notification";
    const waTemplateLang = Deno.env.get("WA_TEMPLATE_LANG") || "es_CO";
    const waGraphVersion = Deno.env.get("WA_GRAPH_VERSION") || "v19.0";
    const senderName = Deno.env.get("SENDER_NAME") || "Import Corporal Medical";
    const sleepMs = parseInt(Deno.env.get("SEND_DELAY_MS") || "500");

    const { jobId, rows } = await req.json() as { jobId: string; rows: MessageRow[] };

    if (!jobId || !rows?.length) {
      return new Response(
        JSON.stringify({ error: "Missing jobId or rows" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentOk = 0;
    let sentFailed = 0;

    for (const row of rows) {
      let status = "FAILED";
      let errorMessage: string | null = null;
      let waMessageId: string | null = null;

      try {
        if (!waToken || !waPhoneId) {
          throw new Error("WhatsApp credentials not configured (WA_TOKEN, WA_PHONE_NUMBER_ID)");
        }

        const url = `https://graph.facebook.com/${waGraphVersion}/${waPhoneId}/messages`;
        const body = {
          messaging_product: "whatsapp",
          to: row.phone_e164.replace("+", ""),
          type: "template",
          template: {
            name: waTemplateName,
            language: { code: waTemplateLang },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: row.recipient_name },
                  { type: "text", text: senderName },
                  { type: "text", text: row.guide_number },
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
          status = "SENT";
          waMessageId = waData.messages[0].id;
          sentOk++;
        } else {
          errorMessage = waData.error?.message || JSON.stringify(waData);
          sentFailed++;
        }
      } catch (err) {
        errorMessage = (err as Error).message;
        sentFailed++;
      }

      // Insert message record (upsert to handle unique constraint)
      await supabase.from("sent_messages").upsert(
        {
          job_id: jobId,
          phone_e164: row.phone_e164,
          guide_number: row.guide_number,
          recipient_name: row.recipient_name,
          sender_name: senderName,
          template_name: waTemplateName,
          wa_message_id: waMessageId,
          status,
          error_message: errorMessage,
        },
        { onConflict: "phone_e164,guide_number" }
      );

      // Rate limiting
      if (sleepMs > 0) {
        await new Promise((r) => setTimeout(r, sleepMs));
      }
    }

    // Update job stats
    await supabase
      .from("jobs")
      .update({ sent_ok: sentOk, sent_failed: sentFailed, status: "COMPLETED" })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ sent_ok: sentOk, sent_failed: sentFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
