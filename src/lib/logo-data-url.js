import { resolveBrandingUrl } from "@/lib/branding-url";

const cache = new Map();

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(new Error("read failed"));
    fr.readAsDataURL(blob);
  });
}

function measure(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

/**
 * Resolve a (possibly legacy private-bucket) image URL into an inline data URL
 * plus its natural dimensions. Data URLs remove load-timing, CORS and
 * signed-URL-expiry problems when printing or embedding in a .docx.
 * Returns null when the image can't be fetched.
 */
export async function toImageDataUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("data:")) {
    const dims = await measure(url);
    return { dataUrl: url, ...dims };
  }
  if (cache.has(url)) return cache.get(url);

  const promise = (async () => {
    try {
      const resolved = await resolveBrandingUrl(url);
      const res = await fetch(resolved, { mode: "cors", cache: "no-store" });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.size || blob.size > 8 * 1024 * 1024) return null;
      const dataUrl = await blobToDataUrl(blob);
      const dims = await measure(dataUrl);
      return { dataUrl, type: blob.type || "image/png", ...dims };
    } catch {
      return null;
    }
  })();

  cache.set(url, promise);
  const result = await promise;
  cache.set(url, result);
  return result;
}

/** Height-constrained <img> style that preserves the natural aspect ratio. */
export function aspectStyle(image, maxHeightPx, maxWidthPx = 320) {
  if (!image?.width || !image?.height) return `height:${maxHeightPx}px;width:auto;`;
  const ratio = image.width / image.height;
  let h = maxHeightPx;
  let w = h * ratio;
  if (w > maxWidthPx) {
    w = maxWidthPx;
    h = w / ratio;
  }
  return `height:${Math.round(h)}px;width:${Math.round(w)}px;`;
}
