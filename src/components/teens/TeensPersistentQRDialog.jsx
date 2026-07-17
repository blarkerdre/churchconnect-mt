import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Copy, Download } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useTenant } from "@/contexts/TenantContext";

export default function TeensPersistentQRDialog({ open, onOpenChange }) {
  const { currentTenant, tenantSlug } = useTenant();
  const qrRef = useRef();

  const url = tenantSlug
    ? `${window.location.origin}/t/${tenantSlug}/teens/checkin`
    : "";
  const churchName = currentTenant?.name || "Church";
  const label = `${churchName} — Teens Attendance`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast({ title: "Check-in link copied" });
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
      ctx.fillStyle = "#1e3a5f";
      ctx.font = "bold 18px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, canvas.width / 2, labelHeight);
      ctx.drawImage(img, 0, labelHeight + padding / 2, 512, 512);
      const a = document.createElement("a");
      a.download = `${tenantSlug || "church"}-teens-attendance-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>
          <QrCode className="h-5 w-5" /> Teens Attendance QR
        </TenantDialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm font-semibold text-center text-primary">{label}</p>
          <div ref={qrRef} className="flex justify-center p-6 bg-white rounded-xl border border-border">
            {url ? <QRCodeSVG value={url} size={240} level="H" includeMargin /> : null}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            One code for every session. When a session is open, scanners are taken straight to check-in.
            When multiple are open, teens pick from a list. When none are open, they see a friendly notice.
          </p>
          <div className="flex items-center gap-2">
            <Input value={url} readOnly className="text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleDownload} className="w-full gap-2">
            <Download className="h-4 w-4" /> Download QR code
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
