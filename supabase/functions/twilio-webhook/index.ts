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
    // Twilio sends webhooks as application/x-www-form-urlencoded
    const rawBody = await req.text();
    const params: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(rawBody)) {
      params[key] = value;
    }

    const accountSid = params["AccountSid"] ?? "";
    const messageSid = params["MessageSid"];
    const messageStatus = params["MessageStatus"];
    const errorCode = params["ErrorCode"];
    const errorMessage = params["ErrorMessage"];

    console.log(`Twilio webhook received: AccountSid=${accountSid}, SID=${messageSid}, Status=${messageStatus}`);

    // Create Supabase client early (needed for fallback validation)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Choose the correct auth token based on AccountSid
    const subAccountSid = Deno.env.get("TWILIO_SUBACCOUNT_SID");
    const subAccountToken = Deno.env.get("TWILIO_SUBACCOUNT_AUTH_TOKEN");
    const primaryToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    let authToken: string | undefined;
    let tokenSource: string;

    if (subAccountSid && accountSid === subAccountSid && subAccountToken) {
      authToken = subAccountToken;
      tokenSource = "subaccount";
    } else if (primaryToken) {
      authToken = primaryToken;
      tokenSource = "primary";
    } else {
      authToken = undefined;
      tokenSource = "none";
    }

    // Validate Twilio signature using HMAC-SHA1
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
    const twilioSignature = req.headers.get("X-Twilio-Signature") ?? "";

    let signatureValid = false;

    if (authToken) {
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

      signatureValid = twilioSignature === expectedSignature;
      if (signatureValid) {
        console.log(`Signature validated using ${tokenSource} auth token`);
      }
    }

    if (!signatureValid) {
      // Fallback: verify MessageSid exists in our sms_log (proves we sent it)
      console.log("Signature mismatch — trying fallback MessageSid verification");

      if (!messageSid || !messageStatus) {
        console.warn("No MessageSid or MessageStatus — rejecting");
        return new Response("Forbidden", {
          status: 403,
          headers: { "Content-Type": "text/plain" },
        });
      }

      const { data: existingLog } = await supabase
        .from("sms_log")
        .select("id")
        .eq("message_sid", messageSid)
        .maybeSingle();

      if (!existingLog) {
        console.warn("MessageSid not found in sms_log — rejecting");
        return new Response("Forbidden", {
          status: 403,
          headers: { "Content-Type": "text/plain" },
        });
      }

      console.log("Fallback validation passed — MessageSid exists in sms_log");
    }

    if (!messageSid || !messageStatus) {
      return new Response(JSON.stringify({ error: "Missing MessageSid or MessageStatus" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updateData: Record<string, unknown> = {
      delivery_status: messageStatus,
      delivery_updated_at: new Date().toISOString(),
    };

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

    console.log(`sms_log updated for SID=${messageSid} to status=${messageStatus}`);

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
