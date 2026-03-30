import { createClient } from "npm:@supabase/supabase-js@2";

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
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!authToken) {
      console.error("TWILIO_AUTH_TOKEN not configured");
      return new Response("<Response></Response>", {
        status: 500,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Twilio sends webhooks as application/x-www-form-urlencoded
    const rawBody = await req.text();
    const params: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(rawBody)) {
      params[key] = value;
    }

    // Reconstruct the URL as Twilio sees it using forwarded headers
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "";
    const urlObj = new URL(req.url);
    const webhookUrl = `${proto}://${host}${urlObj.pathname}${urlObj.search}`;

    // Validate Twilio signature using HMAC-SHA1
    const twilioSignature = req.headers.get("X-Twilio-Signature") ?? "";

    // Build the data string: URL + sorted params key+value
    const data =
      webhookUrl +
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
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)));

    if (twilioSignature !== expectedSignature) {
      console.warn("Invalid Twilio signature — rejecting webhook");
      console.warn("Expected URL used for signing:", webhookUrl);
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
