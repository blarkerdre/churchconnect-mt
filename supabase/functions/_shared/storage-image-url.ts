export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Template and logo images may only be downloaded from this app's own file
 * storage. Church admins can type any address into a template, so anything
 * else (other websites, internal addresses) is refused rather than fetched.
 */
export function ownStorageImageUrl(url: string): string | null {
  const base = Deno.env.get("SUPABASE_URL") || "";
  let own: URL;
  let target: URL;
  try {
    own = new URL(base);
    target = new URL(url);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" || own.protocol !== "https:") return null;
  if (target.host !== own.host) return null;
  if (target.username || target.password) return null;
  if (!target.pathname.startsWith("/storage/v1/object/")) return null;
  if (target.pathname.includes("..")) return null;
  return target.toString();
}
