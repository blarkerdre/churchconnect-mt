// Assignment notices (texts, emails, bell alerts) go out at most once per
// record and person per day, so re-assigning or re-saving a record cannot be
// used to send someone the same notice over and over.
// deno-lint-ignore-file no-explicit-any
const WINDOW_MS = 24 * 60 * 60 * 1000;
const since = () => new Date(Date.now() - WINDOW_MS).toISOString();

/** True when an email whose message id starts with `prefix` was logged in the last day. */
export async function emailSentRecently(supabase: any, prefix: string): Promise<boolean> {
  const safe = prefix.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await supabase
    .from("email_send_log").select("id")
    .like("message_id", `${safe}%`)
    .gte("created_at", since())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** True when this kind of text about this record already went to this number in the last day. */
export async function smsSentRecently(
  supabase: any, smsType: string, referenceId: string, recipientPhone: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("sms_log").select("id")
    .eq("sms_type", smsType)
    .eq("reference_id", referenceId)
    .eq("recipient_phone", recipientPhone)
    .gte("created_at", since())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** True when this person already got a bell alert about this record in the last day. */
export async function notificationSentRecently(
  supabase: any, userId: string, referenceType: string, referenceId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("notifications").select("id")
    .eq("user_id", userId)
    .eq("reference_type", referenceType)
    .eq("reference_id", referenceId)
    .gte("created_at", since())
    .limit(1);
  return (data?.length ?? 0) > 0;
}
