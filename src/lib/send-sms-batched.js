import { supabase } from "@/integrations/supabase/client";

// send-sms accepts at most 500 recipients per request; split larger sends.
export const SMS_BATCH_SIZE = 500;

export async function sendSmsBatched({ recipients, ...rest }) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  let sent = 0, failed = 0, total = 0;
  let lastError = null;
  for (let i = 0; i < recipients.length; i += SMS_BATCH_SIZE) {
    const batch = recipients.slice(i, i + SMS_BATCH_SIZE);
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...rest, recipients: batch }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Stop on the first batch failing outright (nothing sent); otherwise count it.
      if (sent === 0 && failed === 0) throw new Error(data.error || "Send failed");
      lastError = data.error || "Send failed";
      failed += batch.length; total += batch.length;
      break;
    }
    sent += data.sent || 0;
    failed += data.failed || 0;
    total += data.total ?? batch.length;
  }
  return { sent, failed, total, error: lastError };
}
