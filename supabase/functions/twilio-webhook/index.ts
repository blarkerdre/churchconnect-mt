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
    const callSid = params["CallSid"];
    const callStatus = params["CallStatus"];
    const callDuration = params["CallDuration"];

    console.log(`Twilio webhook: AccountSid=${accountSid}, MessageSID=${messageSid}, MessageStatus=${messageStatus}, CallSID=${callSid}, CallStatus=${callStatus}`);

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
      // Fallback: verify SID exists in our logs (proves we sent it)
      console.log("Signature mismatch — trying fallback SID verification");

      if (messageSid) {
        const { data: existingLog } = await supabase
          .from("sms_log")
          .select("id")
          .eq("message_sid", messageSid)
          .maybeSingle();
        if (!existingLog) {
          console.warn("MessageSid not found in sms_log — rejecting");
          return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain" } });
        }
        console.log("Fallback validation passed — MessageSid in sms_log");
      } else if (callSid) {
        const { data: existingCall } = await supabase
          .from("call_log")
          .select("id")
          .eq("provider_call_id", callSid)
          .maybeSingle();
        if (!existingCall) {
          console.warn("CallSid not found in call_log — rejecting");
          return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain" } });
        }
        console.log("Fallback validation passed — CallSid in call_log");
      } else {
        console.warn("No MessageSid or CallSid — rejecting");
        return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain" } });
      }
    }

    // Branch: SMS status
    if (messageSid && messageStatus) {
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
      } else {
        console.log(`sms_log updated for SID=${messageSid} to status=${messageStatus}`);
      }

      return new Response("<Response></Response>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    // Branch: Call status
    if (callSid && callStatus) {
      const s = callStatus.toLowerCase();
      // Map Twilio call statuses to our call_log.status
      let mappedStatus = s;
      if (s === "in-progress") mappedStatus = "in_progress";
      if (s === "no-answer") mappedStatus = "no_answer";

      const updateData: Record<string, unknown> = {
        status: mappedStatus,
        delivery_status: s,
        delivery_updated_at: new Date().toISOString(),
      };
      if (callDuration && !isNaN(parseInt(callDuration))) {
        updateData.duration_seconds = parseInt(callDuration);
      }

      const { error } = await supabase
        .from("call_log")
        .update(updateData)
        .eq("provider_call_id", callSid);

      if (error) {
        console.error("Failed to update call_log:", error);
      } else {
        console.log(`call_log updated for CallSID=${callSid} to status=${mappedStatus}`);
      }

      return new Response("<Response></Response>", {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    return new Response(JSON.stringify({ error: "Missing MessageSid/MessageStatus or CallSid/CallStatus" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("twilio-webhook error:", error);
    return new Response("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
});
