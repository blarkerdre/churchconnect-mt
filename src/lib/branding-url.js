import { supabase } from "@/integrations/supabase/client";

const PRIVATE_FRAGMENT = "/object/public/church-documents/";

/**
 * Older Bible School / certificate logos were written to the private
 * `church-documents` bucket with a public URL that never resolves.
 * Turn those into a working signed URL; leave every other URL untouched.
 */
export async function resolveBrandingUrl(url) {
  if (!url || typeof url !== "string") return url || "";
  const idx = url.indexOf(PRIVATE_FRAGMENT);
  if (idx === -1) return url;
  const path = decodeURIComponent(url.slice(idx + PRIVATE_FRAGMENT.length).split("?")[0]);
  try {
    const { data } = await supabase.storage
      .from("church-documents")
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl || url;
  } catch {
    return url;
  }
}
