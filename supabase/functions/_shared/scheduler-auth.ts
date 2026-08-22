// Shared authentication helper for pg_cron-triggered edge functions.
//
// Historically these functions compared the Authorization bearer against
// SUPABASE_SERVICE_ROLE_KEY. That breaks silently whenever API keys are
// rotated, because the key literal baked into the cron job body goes stale
// and every run gets a 403 while messages pile up in the queue.
//
// The scheduler now also sends an `x-job-token` header read from
// public.internal_job_tokens at run time. This helper accepts either.

export async function isAuthorizedScheduler(
  req: Request,
  client: any,
): Promise<boolean> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (serviceKey && bearer === serviceKey) return true;

  const jobToken = req.headers.get("x-job-token") ?? "";
  if (!jobToken) return false;

  try {
    const { data, error } = await client
      .from("internal_job_tokens")
      .select("token")
      .eq("name", "scheduler")
      .maybeSingle();
    if (error || !data?.token) return false;
    return timingSafeEqual(jobToken, data.token as string);
  } catch (_e) {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
