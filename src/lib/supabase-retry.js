/**
 * Retry helper for transient auth-clock errors.
 *
 * Right after sign-in the access token can be stamped a second or two ahead of
 * the API server's clock, so PostgREST rejects it with
 * `PGRST303 - JWT issued at future`. It resolves itself within a moment, so we
 * simply wait and retry instead of surfacing a hard failure.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isClockSkewError(error) {
  if (!error) return false;
  const code = error.code || error?.error?.code;
  const message = String(error.message || error?.error?.message || "");
  return code === "PGRST303" || /JWT issued at future|issued in the future/i.test(message);
}

/**
 * Runs a Supabase query builder factory, retrying on clock-skew errors.
 * @param {() => PromiseLike<{ data: any, error: any }>} run
 */
export async function withClockSkewRetry(run, { attempts = 3, delayMs = 750 } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      last = await run();
    } catch (err) {
      if (isClockSkewError(err) && i < attempts - 1) {
        await sleep(delayMs * (i + 1));
        continue;
      }
      throw err;
    }
    if (last?.error && isClockSkewError(last.error) && i < attempts - 1) {
      await sleep(delayMs * (i + 1));
      continue;
    }
    return last;
  }
  return last;
}
