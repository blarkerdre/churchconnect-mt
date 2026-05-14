import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share, Plus, Smartphone } from "lucide-react";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { useTenant } from "@/contexts/TenantContext";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { toast } from "sonner";

const dismissKey = (tenantId) => `pwa-install-dismissed:${tenantId || "default"}`;
const DISMISS_DAYS = 7;

export function shouldAutoOpenInstall(tenantId) {
  try {
    const ts = window.localStorage?.getItem(dismissKey(tenantId));
    if (!ts) return true;
    const ageDays = (Date.now() - parseInt(ts, 10)) / (1000 * 60 * 60 * 24);
    return ageDays >= DISMISS_DAYS;
  } catch {
    return true;
  }
}

export default function InstallAppDialog({ open, onOpenChange }) {
  const { currentTenant, tenantId } = useTenant();
  const { canPrompt, isIOS, isInstalled, promptInstall } = useInstallPrompt();
  const tenantName = currentTenant?.name || "the app";
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isInstalled && open) onOpenChange(false);
  }, [isInstalled, open, onOpenChange]);

  const handleInstall = async () => {
    setBusy(true);
    try {
      const result = await promptInstall();
      if (result?.outcome === "accepted") {
        toast.success(`${tenantName} is being installed`);
        onOpenChange(false);
      } else if (result?.outcome === "dismissed") {
        handleDismiss();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try {
      window.localStorage?.setItem(dismissKey(tenantId), String(Date.now()));
    } catch { /* ignore */ }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleDismiss())}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>
          <Smartphone className="h-5 w-5" />
          Install {tenantName}
        </TenantDialogHeader>
        <DialogDescription className="text-base text-foreground">
          Get one-tap access from your home screen — works offline, loads instantly,
          and feels just like a native app.
        </DialogDescription>

        {isIOS ? (
          <ol className="space-y-3 text-sm bg-muted/50 rounded-md p-4 mt-2">
            <li className="flex items-start gap-2">
              <span className="font-semibold">1.</span>
              <span className="flex items-center gap-1.5">
                Tap the <Share className="h-4 w-4 inline" /> <strong>Share</strong> button at the bottom of Safari.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">2.</span>
              <span className="flex items-center gap-1.5">
                Scroll and tap <Plus className="h-4 w-4 inline" /> <strong>Add to Home Screen</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">3.</span>
              <span>Tap <strong>Add</strong>. The {tenantName} icon will appear on your home screen.</span>
            </li>
          </ol>
        ) : canPrompt ? (
          <p className="text-sm text-muted-foreground">
            Tap <strong>Install</strong> below to add {tenantName} to your device.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Open this site on your phone (Chrome on Android or Safari on iPhone) to install it
            to your home screen. On desktop Chrome/Edge, look for the install icon in the address bar.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Maybe later
          </Button>
          {canPrompt && !isIOS && (
            <Button onClick={handleInstall} disabled={busy}>
              <Download className="h-4 w-4 mr-2" />
              Install
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
