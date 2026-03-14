import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Twilio sends webhooks as application/x-www-form-urlencoded
    const formData = await req.formData();
    const messageSid = formData.get("MessageSid")?.toString();
    const messageStatus = formData.get("MessageStatus")?.toString();
    const errorCode = formData.get("ErrorCode")?.toString();
    const errorMessage = formData.get("ErrorMessage")?.toString();

    console.log(`Twilio webhook: SID=${messageSid}, Status=${messageStatus}`);

    if (!messageSid || !messageStatus) {
      return new Response(JSON.stringify({ error: "Missing MessageSid or MessageStatus" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const updateData: Record<string, unknown> = {
      delivery_status: messageStatus,
      delivery_updated_at: new Date().toISOString(),
    };

    // Update status based on Twilio status
    if (messageStatus === "delivered") {
      updateData.status = "delivered";
    } else if (["failed", "undelivered"].includes(messageStatus)) {
      updateData.status = "failed";
      if (errorCode || errorMessage) {
        updateData.error_message = `${errorCode || ""}: ${errorMessage || "Delivery failed"}`.trim();
      }
    }

    const { error } = await supabase
      .from("sms_log")
      .update(updateData)
      .eq("message_sid", messageSid);

    if (error) {
      console.error("Failed to update sms_log:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Twilio expects 200 with empty body or TwiML
    return new Response("<Response></Response>", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("twilio-webhook error:", error);
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
});
