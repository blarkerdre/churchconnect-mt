import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Copy, QrCode } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function WoFBIRegistrationQRCode({ open, onOpenChange }) {
  const qrRef = useRef();
  const registrationUrl = `${window.location.origin}/wofbi-register`;

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
      canvas.width = 512;
      canvas.height = 512;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 512, 512);
      ctx.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement("a");
      a.download = "wofbi-registration-qr-code.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" /> WoFBI Registration QR Code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div ref={qrRef} className="flex justify-center p-6 bg-white rounded-xl border border-border">
            <QRCodeSVG value={registrationUrl} size={220} level="H" includeMargin />
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
