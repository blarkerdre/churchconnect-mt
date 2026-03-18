import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { timingSafeEqual } from "https://deno.land/std@0.224.0/crypto/timing_safe_equal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): Promise<string> {
  // Sort params alphabetically and concatenate key+value
  const data =
    url +
    Object.keys(params)
      .sort()
      .reduce((acc, key) => acc + key + params[key], "");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!authToken) {
      console.error("TWILIO_AUTH_TOKEN not configured");
      return new Response("<Response></Response>", {
        status: 500,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Twilio sends webhooks as application/x-www-form-urlencoded
    const formData = await req.formData();
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    // Validate Twilio signature
    const twilioSignature = req.headers.get("X-Twilio-Signature") ?? "";
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/twilio-webhook`;
    const expectedSignature = await computeTwilioSignature(authToken, webhookUrl, params);

    const encoder = new TextEncoder();
    const sigA = encoder.encode(twilioSignature);
    const sigB = encoder.encode(expectedSignature);

    if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
      console.warn("Invalid Twilio signature — rejecting webhook");
      return new Response("Forbidden", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const messageSid = params["MessageSid"];
    const messageStatus = params["MessageStatus"];
    const errorCode = params["ErrorCode"];
    const errorMessage = params["ErrorMessage"];

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
      return new Response("<Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
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
