import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Copy, Download, Users, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";

export default function PrepreteenAttendanceQRDialog({ open, onOpenChange, session, onClosed }) {
  const { currentTenant, tenantSlug } = useTenant();
  const qrRef = useRef();
  const [count, setCount] = useState(0);
  const [closing, setClosing] = useState(false);

  const path = tenantSlug ? `/t/${tenantSlug}/preteens/checkin/${session?.qr_token}` : `/preteens/checkin/${session?.qr_token}`;
  const url = session ? `${window.location.origin}${path}` : "";
  const churchName = currentTenant?.name || "Church";
  const label = `${churchName} — ${session?.title || "Prepreteens Attendance"}`;

  useEffect(() => {
    if (!open || !session?.id) return;
    let active = true;
    const load = async () => {
      const { count: c } = await supabase
        .from("preteen_attendance_records")
        .select("id", { count: "exact", head: true })
        .eq("session_id", session.id);
      if (active) setCount(c || 0);
    };
    load();
    const channel = supabase
      .channel(`preteen-att-${session.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "preteen_attendance_records", filter: `session_id=eq.${session.id}` },
        () => load())
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [open, session?.id]);

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
      a.download = `${session?.title?.replace(/\s+/g, "-") || "preteens-attendance"}-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(data)));
  };

  const handleClose = async () => {
    if (!session) return;
    setClosing(true);
    const { error } = await supabase.from("preteen_attendance_sessions").update({ status: "closed" }).eq("id", session.id);
    setClosing(false);
    if (error) { toast({ title: "Failed to close session", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Session closed" });
    onClosed?.();
    onOpenChange(false);
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>
          <QrCode className="h-5 w-5" /> Prepreteens Check-in
        </TenantDialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm font-semibold text-center text-primary">{label}</p>
          <div ref={qrRef} className="flex justify-center p-6 bg-white rounded-xl border border-border">
            <QRCodeSVG value={url} size={240} level="H" includeMargin />
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span><strong className="text-foreground">{count}</strong> preteen{count === 1 ? "" : "s"} checked in</span>
          </div>
          <div className="flex items-center gap-2">
            <Input value={url} readOnly className="text-xs" />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="outline" className="flex-1 gap-2">
              <Download className="h-4 w-4" /> Download
            </Button>
            {session.status === "open" && (
              <Button onClick={handleClose} disabled={closing} variant="destructive" className="flex-1 gap-2">
                {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Close session
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Prepreteens scan to check in. Parents sign in, or a worker signs the preteen in manually.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
