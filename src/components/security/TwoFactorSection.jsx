import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, ShieldOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";
import {
  listTotpFactors, startTotpEnrolment, verifyTotp, unenrolFactor, cleanupUnverifiedFactors,
} from "@/hooks/useMfa";

export default function TwoFactorSection() {
  const queryClient = useQueryClient();
  const confirmDelete = useConfirmDelete();
  const [open, setOpen] = useState(false);
  const [factorId, setFactorId] = useState(null);
  const [qr, setQr] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: listTotpFactors,
  });
  const enabled = (data?.verified?.length || 0) > 0;

  const beginSetup = async () => {
    setBusy(true);
    try {
      const res = await startTotpEnrolment();
      setFactorId(res.factorId);
      setQr(res.qr);
      setSecret(res.secret);
      setCode("");
      setOpen(true);
    } catch (e) {
      toast({ title: "Could not start setup", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const finishSetup = async () => {
    setBusy(true);
    try {
      await verifyTotp(factorId, code);
      toast({ title: "Two-factor authentication enabled" });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["mfa-factors"] });
    } catch (e) {
      toast({ title: "Verification failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const cancelSetup = async () => {
    setOpen(false);
    await cleanupUnverifiedFactors();
  };

  const remove = async () => {
    const ok = await confirmDelete({
      title: "Turn off two-factor authentication",
      description: "Your account will be protected by password only. You can set it up again at any time.",
      confirmLabel: "Turn off",
    });
    if (!ok) return;
    try {
      for (const f of data?.verified || []) await unenrolFactor(f.id);
      toast({ title: "Two-factor authentication turned off" });
      queryClient.invalidateQueries({ queryKey: ["mfa-factors"] });
    } catch (e) {
      toast({ title: "Could not turn it off", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Two-factor authentication
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : enabled ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-0">On</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Off</Badge>
          )}
          <p className="text-sm text-muted-foreground">
            {enabled
              ? "You'll be asked for a 6-digit code from your authenticator app each time you sign in."
              : "Add an authenticator app so a password alone isn't enough to sign in."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!enabled && (
            <Button size="sm" onClick={beginSetup} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <KeyRound className="h-4 w-4 mr-2" /> Set up authenticator
            </Button>
          )}
          {enabled && (
            <Button size="sm" variant="outline" onClick={remove}>
              <ShieldOff className="h-4 w-4 mr-2" /> Turn off
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(next) => { if (!next) cancelSetup(); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto pb-24 sm:pb-6">
          <DialogHeader>
            <DialogTitle>Set up your authenticator</DialogTitle>
            <DialogDescription>
              Scan the QR code with Google Authenticator, 1Password, Authy or similar, then enter the code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {qr && <img src={qr} alt="Authenticator QR code" className="mx-auto border rounded p-2 bg-white" />}
            {secret && (
              <p className="text-xs text-muted-foreground break-all text-center">
                Manual key: <code className="font-mono">{secret}</code>
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Verification code</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                placeholder="123456"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={cancelSetup}>Cancel</Button>
            <Button onClick={finishSetup} disabled={busy || code.length !== 6}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Verify &amp; enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
