import { useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";

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

  // Dynamic favicon
  useEffect(() => {
    const faviconUrl = currentTenant?.settings?.favicon_url;
    const link = document.querySelector('link[rel="icon"]') || (() => {
      const el = document.createElement("link");
      el.rel = "icon";
      document.head.appendChild(el);
      return el;
    })();

    if (faviconUrl) {
      link.href = faviconUrl;
      link.type = faviconUrl.endsWith(".png") ? "image/png" : faviconUrl.endsWith(".svg") ? "image/svg+xml" : "image/jpeg";
    } else {
      link.href = "/favicon.jpg";
      link.type = "image/jpeg";
    }

    return () => {
      link.href = "/favicon.jpg";
      link.type = "image/jpeg";
    };
  }, [currentTenant?.settings?.favicon_url]);

  // Dynamic PWA manifest & apple-touch-icon
  useEffect(() => {
    const pwaIconUrl = currentTenant?.settings?.pwa_icon_url;
    const iconUrl = pwaIconUrl || currentTenant?.logo_url || null;
    const tenantName = currentTenant?.name || "Winners Chapel Cardiff";

    // Build manifest JSON
    const manifest = {
      name: tenantName,
      short_name: tenantName.length > 12 ? tenantName.slice(0, 12).trim() : tenantName,
      description: `Church Management Suite for ${tenantName}`,
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#1e3a5f",
      icons: iconUrl
        ? [
            { src: iconUrl, sizes: "192x192", type: "image/png" },
            { src: iconUrl, sizes: "512x512", type: "image/png" },
          ]
        : [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const blobUrl = URL.createObjectURL(blob);

    // Update or create <link rel="manifest">
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = blobUrl;

    // Update or create <link rel="apple-touch-icon">
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = iconUrl || "/icon-192.png";

    return () => {
      URL.revokeObjectURL(blobUrl);
      manifestLink.href = "/manifest.json";
      appleIcon.href = "/icon-192.png";
    };
  }, [currentTenant?.settings?.pwa_icon_url, currentTenant?.logo_url, currentTenant?.name]);

  // Dynamic OG image meta tags
  useEffect(() => {
    const ogImageUrl = currentTenant?.settings?.og_image_url;

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

    if (ogImageUrl) {
      setMeta('meta[property="og:image"]', { property: "og:image" }, ogImageUrl);
      setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, ogImageUrl);
    }

    return () => {
      // Restore defaults
      const defaultOg = "https://storage.googleapis.com/gpt-engineer-file-uploads/dSCGfUp63RcMNJCUiPXsrrXGnlr2/social-images/social-1773439127872-1000559797.webp";
      setMeta('meta[property="og:image"]', { property: "og:image" }, defaultOg);
      setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, defaultOg);
    };
  }, [currentTenant?.settings?.og_image_url]);

  return children;
}
