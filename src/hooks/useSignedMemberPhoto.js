import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const TTL_SECONDS = 3600;
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh when within 5 min of expiry
const cache = new Map(); // path -> { url, expiresAt, promise }

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

/**
 * Given a stored value from `members.photo_url`, return a usable image URL.
 * - null/undefined → null
 * - legacy full http(s) URL → returned as-is (transitional)
 * - storage path (e.g. "<uid>/file.jpg") → short-lived signed URL from `profile-photos`
 */
export function useSignedMemberPhoto(pathOrUrl) {
  const [url, setUrl] = useState(() => {
    if (!pathOrUrl) return null;
    if (isHttpUrl(pathOrUrl)) return pathOrUrl;
    const cached = cache.get(pathOrUrl);
    if (cached && cached.url && cached.expiresAt - Date.now() > REFRESH_BEFORE_MS) {
      return cached.url;
    }
    return null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) {
      setUrl(null);
      return () => {};
    }
    if (isHttpUrl(pathOrUrl)) {
      setUrl(pathOrUrl);
      return () => {};
    }

    const cached = cache.get(pathOrUrl);
    if (cached && cached.url && cached.expiresAt - Date.now() > REFRESH_BEFORE_MS) {
      setUrl(cached.url);
      return () => {};
    }

    setLoading(true);
    const existingPromise = cached?.promise;
    const promise =
      existingPromise ||
      supabase.storage
        .from("profile-photos")
        .createSignedUrl(pathOrUrl, TTL_SECONDS)
        .then(({ data, error }) => {
          if (error || !data?.signedUrl) {
            cache.delete(pathOrUrl);
            return null;
          }
          const entry = {
            url: data.signedUrl,
            expiresAt: Date.now() + TTL_SECONDS * 1000,
          };
          cache.set(pathOrUrl, entry);
          return entry.url;
        });

    cache.set(pathOrUrl, { ...(cached || {}), promise });

    promise.then((signed) => {
      if (cancelled) return;
      setUrl(signed || null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  return { url, loading };
}
