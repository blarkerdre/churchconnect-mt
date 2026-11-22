/**
 * Push alerts may only be sent to the real browser push services. The address
 * comes from a person's device sign-up, so anything else is refused rather
 * than letting the server contact an address someone typed in.
 */
const PUSH_HOST = /^(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com)$/;

export function isKnownPushEndpoint(endpoint: string | null | undefined): boolean {
  if (!endpoint) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && PUSH_HOST.test(u.hostname);
  } catch {
    return false;
  }
}
