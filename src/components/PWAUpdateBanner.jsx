import { useEffect, useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "pwa:installedBranding";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function detectPlatform() {
  const ua = window.navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

export default function PWAUpdateBanner() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [stale, setStale] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (!user || !currentTenant?.name) return;
    if (!isStandalone()) return;

    const current = {
      slug: currentTenant.slug || null,
      name: currentTenant.name || null,
      logoUrl: currentTenant.logo_url || null,
    };

    let stored;
    try {
      stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      stored = null;
    }

    if (!stored) {
      // First standalone launch — record fingerprint as the install snapshot.
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...current, at: Date.now() })
        );
      } catch {
        /* ignore */
      }
      setStale(false);
      return;
    }

    // Only flag staleness within the same tenant (slug match)
    if (stored.slug && current.slug && stored.slug !== current.slug) {
      setStale(false);
      return;
    }

    const isStale =
      stored.name !== current.name || stored.logoUrl !== current.logoUrl;
    setStale(isStale);
  }, [user, currentTenant?.name, currentTenant?.logo_url, currentTenant?.slug]);

  const dismiss = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          slug: currentTenant?.slug || null,
          name: currentTenant?.name || null,
          logoUrl: currentTenant?.logo_url || null,
          at: Date.now(),
        })
      );
    } catch {
      /* ignore */
    }
    setStale(false);
    setShowInstructions(false);
  };

  if (!stale) return null;

  const platform = detectPlatform();

  return (
    <div className="bg-accent/10 border-b border-accent/30 px-3 lg:px-8 py-2.5 text-xs">
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-foreground font-medium">
            Your installed app shows outdated branding for{" "}
            <span className="font-semibold">{currentTenant?.name}</span>.
          </p>
          {!showInstructions ? (
            <p className="text-muted-foreground mt-0.5">
              Reinstall to update the icon and name on your home screen.{" "}
              <button
                onClick={() => setShowInstructions(true)}
                className="text-accent underline underline-offset-2 hover:opacity-80"
              >
                Show how
              </button>
            </p>
          ) : (
            <div className="mt-2 space-y-1.5 text-muted-foreground">
              {platform === "ios" && (
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Long-press the app icon on your home screen → Remove App.</li>
                  <li>Open this site in Safari.</li>
                  <li>Tap the Share button → Add to Home Screen.</li>
                </ol>
              )}
              {platform === "android" && (
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Long-press the app icon → App info → Uninstall.</li>
                  <li>Open this site in Chrome.</li>
                  <li>Open the menu → Install app (or Add to Home screen).</li>
                </ol>
              )}
              {platform === "other" && (
                <p className="flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  Uninstall the app, then reinstall it from your browser.
                </p>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
