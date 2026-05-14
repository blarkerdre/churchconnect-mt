import { useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Converts a hex color (#rrggbb) to HSL values string "H S% L%".
 */
function hexToHsl(hex) {
  if (!hex || !hex.startsWith("#")) return null;
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Load an image with CORS enabled so canvas isn't tainted. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Render a logo onto a square canvas with white background, contained & centered. */
async function renderSquareIcon(logoUrl, size, bg = "#ffffff") {
  try {
    const img = await loadImage(logoUrl);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);
    const pad = Math.round(size * 0.08);
    const avail = size - pad * 2;
    const scale = Math.min(avail / img.width, avail / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** Render an OG card (1200x630) with brand bg, centered logo, and tenant name. */
async function renderOgCard(logoUrl, name, primaryHex) {
  try {
    const W = 1200, H = 630;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background gradient using primary color
    const bg = primaryHex && /^#([0-9a-f]{6})$/i.test(primaryHex) ? primaryHex : "#1e3a5f";
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, bg);
    grad.addColorStop(1, "#0b1a2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Logo
    let logoBottom = H / 2;
    if (logoUrl) {
      const img = await loadImage(logoUrl).catch(() => null);
      if (img) {
        const maxLogo = 320;
        const scale = Math.min(maxLogo / img.width, maxLogo / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (W - w) / 2;
        const y = H / 2 - h / 2 - 40;
        // White rounded plate behind logo for contrast
        const plate = Math.max(w, h) + 48;
        const px = (W - plate) / 2;
        const py = y + h / 2 - plate / 2;
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        const r = 32;
        ctx.beginPath();
        ctx.moveTo(px + r, py);
        ctx.arcTo(px + plate, py, px + plate, py + plate, r);
        ctx.arcTo(px + plate, py + plate, px, py + plate, r);
        ctx.arcTo(px, py + plate, px, py, r);
        ctx.arcTo(px, py, px + plate, py, r);
        ctx.closePath();
        ctx.fill();
        ctx.drawImage(img, x, y, w, h);
        logoBottom = py + plate;
      }
    }

    // Tenant name
    if (name) {
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "700 56px 'Playfair Display', Georgia, serif";
      ctx.fillText(name, W / 2, Math.min(logoBottom + 32, H - 100));
    }

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Given HSL string "H S% L%", returns a lighter/darker variant.
 */
function adjustLightness(hsl, delta) {
  if (!hsl) return null;
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return hsl;
  const h = parseInt(parts[1]);
  const s = parseInt(parts[2]);
  const l = Math.max(0, Math.min(100, parseInt(parts[3]) + delta));
  return `${h} ${s}% ${l}%`;
}

/**
 * Determines if a color is "light" (needs dark foreground text).
 */
function isLightColor(hsl) {
  if (!hsl) return false;
  const parts = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!parts) return false;
  return parseInt(parts[3]) > 55;
}

/**
 * TenantThemeProvider reads the active tenant's primary_color from settings
 * and applies it as CSS custom properties on the document root.
 * When the tenant changes or has no custom color, defaults are restored.
 */
export default function TenantThemeProvider({ children }) {
  const { currentTenant } = useTenant();

  useEffect(() => {
    const root = document.documentElement;
    const primaryColor = currentTenant?.settings?.primary_color;
    const primaryHsl = hexToHsl(primaryColor);

    if (primaryHsl) {
      // Primary color
      root.style.setProperty("--primary", primaryHsl);
      root.style.setProperty("--ring", primaryHsl);
      root.style.setProperty("--chart-1", primaryHsl);

      // Foreground for primary buttons — light bg needs dark text
      if (isLightColor(primaryHsl)) {
        root.style.setProperty("--primary-foreground", "215 45% 15%");
      } else {
        root.style.setProperty("--primary-foreground", "40 33% 98%");
      }

      // Sidebar variants
      root.style.setProperty("--sidebar-background", adjustLightness(primaryHsl, -6));
      root.style.setProperty("--sidebar-accent", primaryHsl);
      root.style.setProperty("--sidebar-border", adjustLightness(primaryHsl, -3));
    } else {
      // Restore defaults (from index.css :root)
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--chart-1");
      root.style.removeProperty("--sidebar-background");
      root.style.removeProperty("--sidebar-accent");
      root.style.removeProperty("--sidebar-border");
    }

    return () => {
      // Cleanup on unmount
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--chart-1");
      root.style.removeProperty("--sidebar-background");
      root.style.removeProperty("--sidebar-accent");
      root.style.removeProperty("--sidebar-border");
    };
  }, [currentTenant?.settings?.primary_color]);

  // Dynamic favicon (uses tenant logo as fallback, fitted to 64x64)
  useEffect(() => {
    const faviconUrl = currentTenant?.settings?.favicon_url;
    const logoUrl = currentTenant?.logo_url;
    let cancelled = false;

    const link = document.querySelector('link[rel="icon"]') || (() => {
      const el = document.createElement("link");
      el.rel = "icon";
      document.head.appendChild(el);
      return el;
    })();

    const apply = (href, type) => {
      if (cancelled) return;
      link.href = href;
      link.type = type;
    };

    if (faviconUrl) {
      apply(faviconUrl, faviconUrl.endsWith(".png") ? "image/png" : faviconUrl.endsWith(".svg") ? "image/svg+xml" : "image/jpeg");
    } else if (logoUrl) {
      // Fit logo onto a 64x64 square (white bg) for a clean tab icon
      renderSquareIcon(logoUrl, 64).then((dataUrl) => {
        if (dataUrl) apply(dataUrl, "image/png");
        else apply("/favicon.jpg", "image/jpeg");
      });
    } else {
      apply("/favicon.jpg", "image/jpeg");
    }

    return () => {
      cancelled = true;
      link.href = "/favicon.jpg";
      link.type = "image/jpeg";
    };
  }, [currentTenant?.settings?.favicon_url, currentTenant?.logo_url]);

  // Dynamic PWA manifest (served from edge function with real PNG icons in storage)
  useEffect(() => {
    const tenantId = currentTenant?.id || null;
    const tenantSlug = currentTenant?.slug || null;
    const tenantName = currentTenant?.name || null;
    const logoUrl = currentTenant?.logo_url || currentTenant?.settings?.pwa_icon_url || null;
    let cancelled = false;

    const setLink = (rel, href, attrs = {}) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) {
        el = document.createElement("link");
        el.rel = rel;
        document.head.appendChild(el);
      }
      el.href = href;
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    const setAppleTitle = (title) => {
      let el = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", "apple-mobile-web-app-title");
        document.head.appendChild(el);
      }
      el.setAttribute("content", title);
    };

    // Point manifest at the edge function for this tenant (or the static fallback)
    if (tenantSlug && SUPABASE_URL) {
      setLink("manifest", `${SUPABASE_URL}/functions/v1/get-manifest?tenant=${encodeURIComponent(tenantSlug)}`);
    } else {
      setLink("manifest", "/manifest.json");
    }
    if (tenantName) setAppleTitle(tenantName);

    // Generate + upload PNG icons for this tenant if we have a logo and they aren't cached yet
    const uploadIcons = async () => {
      if (!tenantId || !logoUrl) return;
      const versionKey = `pwa-icons:${tenantId}:${logoUrl}`;
      try {
        if (typeof window !== "undefined" && window.localStorage?.getItem(versionKey)) return;
      } catch { /* ignore */ }

      const sizes = [
        { name: "icon-192.png", size: 192 },
        { name: "icon-512.png", size: 512 },
        { name: "apple-touch-icon.png", size: 180 },
      ];

      for (const { name, size } of sizes) {
        if (cancelled) return;
        const dataUrl = await renderSquareIcon(logoUrl, size);
        if (!dataUrl) continue;
        const blob = await (await fetch(dataUrl)).blob();
        const path = `${tenantId}/${name}`;
        const { error } = await supabase.storage
          .from("tenant-pwa-icons")
          .upload(path, blob, { upsert: true, contentType: "image/png", cacheControl: "31536000" });
        if (error) {
          console.warn("PWA icon upload failed:", name, error.message);
          return;
        }
      }

      try { window.localStorage?.setItem(versionKey, "1"); } catch { /* ignore */ }

      // Point apple-touch-icon at the freshly uploaded public file
      if (!cancelled && SUPABASE_URL) {
        setLink(
          "apple-touch-icon",
          `${SUPABASE_URL}/storage/v1/object/public/tenant-pwa-icons/${tenantId}/apple-touch-icon.png`
        );
      }
    };

    // If icons already known to be uploaded, point apple-touch-icon at them immediately
    if (tenantId && SUPABASE_URL) {
      const versionKey = `pwa-icons:${tenantId}:${logoUrl}`;
      try {
        if (window.localStorage?.getItem(versionKey)) {
          setLink(
            "apple-touch-icon",
            `${SUPABASE_URL}/storage/v1/object/public/tenant-pwa-icons/${tenantId}/apple-touch-icon.png`
          );
        }
      } catch { /* ignore */ }
    }

    uploadIcons();

    return () => { cancelled = true; };
  }, [currentTenant?.id, currentTenant?.slug, currentTenant?.name, currentTenant?.logo_url, currentTenant?.settings?.pwa_icon_url]);

  // Dynamic OG image meta tags (generates 1200x630 card from logo as fallback)
  useEffect(() => {
    const ogImageUrl = currentTenant?.settings?.og_image_url;
    const logoUrl = currentTenant?.logo_url;
    const tenantName = currentTenant?.name;
    const primaryColor = currentTenant?.settings?.primary_color;
    let cancelled = false;

    const setMeta = (selector, attr, value) => {
      let el = document.querySelector(selector);
      if (!el && value) {
        el = document.createElement("meta");
        const [attrName, attrVal] = Object.entries(attr)[0];
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      if (el) el.setAttribute("content", value || "");
    };

    const applyOg = (url) => {
      if (cancelled || !url) return;
      setMeta('meta[property="og:image"]', { property: "og:image" }, url);
      setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, url);
    };

    if (ogImageUrl) {
      applyOg(ogImageUrl);
    } else if (logoUrl) {
      renderOgCard(logoUrl, tenantName, primaryColor).then((dataUrl) => {
        if (dataUrl) applyOg(dataUrl);
      });
    }

    return () => {
      cancelled = true;
      const defaultOg = "https://storage.googleapis.com/gpt-engineer-file-uploads/dSCGfUp63RcMNJCUiPXsrrXGnlr2/social-images/social-1773439127872-1000559797.webp";
      setMeta('meta[property="og:image"]', { property: "og:image" }, defaultOg);
      setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, defaultOg);
    };
  }, [
    currentTenant?.settings?.og_image_url,
    currentTenant?.logo_url,
    currentTenant?.name,
    currentTenant?.settings?.primary_color,
  ]);

  return children;
}
