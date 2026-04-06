import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Copy, QrCode } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useTenant } from "@/contexts/TenantContext";

export default function WoFBIRegistrationQRCode({ open, onOpenChange }) {
  const qrRef = useRef();
  const { tenantSlug, currentTenant } = useTenant();

  if (!tenantSlug) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <TenantDialogHeader>
              <QrCode className="h-5 w-5" /> Bible School Registration QR Code
            </TenantDialogHeader>
          <p className="text-sm text-muted-foreground py-4 text-center">
            Unable to generate QR code — church context not resolved yet. Please try again.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  const registrationUrl = `${window.location.origin}/t/${tenantSlug}/wofbi-register`;

  const churchName = currentTenant?.name || "Church";
  const logoUrl = currentTenant?.logo_url || "/winners-logo.png";
  const label = `${churchName} — WoFBI Registration`;

  const handleCopy = () => {
    navigator.clipboard.writeText(registrationUrl);
    toast({ title: "Link copied to clipboard" });
  };

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const padding = 40;
      const labelHeight = 36;
      canvas.width = 512;
      canvas.height = 512 + labelHeight + padding;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw label
      ctx.fillStyle = "#1e3a5f";
      ctx.font = "bold 18px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, canvas.width / 2, labelHeight);
      // Draw QR
      ctx.drawImage(img, 0, labelHeight + padding / 2, 512, 512);
      const a = document.createElement("a");
      a.download = `${tenantSlug || "church"}-wofbi-registration-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <TenantDialogHeader>
            <QrCode className="h-5 w-5" /> WoFBI Registration QR Code
          </TenantDialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm font-semibold text-center text-primary">{label}</p>
          <div ref={qrRef} className="flex justify-center p-6 bg-white rounded-xl border border-border">
            <QRCodeSVG
              value={registrationUrl}
              size={220}
              level="H"
              includeMargin
              imageSettings={{
                src: logoUrl,
                height: 48,
                width: 48,
                excavate: true,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Scan this code to open the WoFBI course registration page
          </p>
          <div className="flex items-center gap-2">
            <Input value={registrationUrl} readOnly className="text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleDownload} className="w-full gap-2">
            <Download className="h-4 w-4" /> Download QR Code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
