import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { listTotpFactors, startTotpEnrolment, verifyTotp, cleanupUnverifiedFactors } from "@/hooks/useMfa";

const SNOOZE_DAYS = 7;

export default function MFASetupDialog() {
  const { user, mfaRequired } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("intro"); // intro | verify | done
  const [factorId, setFactorId] = useState(null);
  const [qr, setQr] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || mfaRequired) return;
    (async () => {
      try {
        // Already protected?
        const { verified } = await listTotpFactors();
        if (verified.length > 0) return;

        // Check snooze
        const { data: profile } = await supabase.from("profiles")
          .select("mfa_prompt_snoozed_until").eq("user_id", user.id).maybeSingle();
        const snoozed = profile?.mfa_prompt_snoozed_until && new Date(profile.mfa_prompt_snoozed_until) > new Date();
        if (snoozed) return;

        // Session-flag so we don't nag repeatedly
        if (sessionStorage.getItem("mfa_prompt_seen") === "1") return;
        sessionStorage.setItem("mfa_prompt_seen", "1");
        setOpen(true);
      } catch (e) { /* silent */ }
    })();
  }, [user, mfaRequired]);

  const startEnrol = async () => {
    setLoading(true);
    try {
      const res = await startTotpEnrolment();
      setFactorId(res.factorId);
      setQr(res.qr);
      setSecret(res.secret);
      setStep("verify");
    } catch (e) {
      toast({ title: "Could not start MFA setup", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const verify = async () => {
    setLoading(true);
    try {
      await verifyTotp(factorId, code);
      toast({ title: "MFA enabled" });
      setStep("done");
      setTimeout(() => setOpen(false), 1500);
    } catch (e) {
      toast({ title: "Verification failed", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };


  const snooze = async () => {
    const until = new Date(Date.now() + SNOOZE_DAYS * 86400_000).toISOString();
    try {
      await supabase.from("profiles").update({ mfa_prompt_snoozed_until: until }).eq("user_id", user.id);
    } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Protect your account
          </DialogTitle>
          <DialogDescription>
            Add two-factor authentication for stronger sign-in security. Takes about a minute.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-3 text-sm">
            <p>You'll need an authenticator app (Google Authenticator, 1Password, Authy, etc.).</p>
            <p className="text-muted-foreground">Optional — you can enable it later from settings.</p>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-3">
            <p className="text-sm">Scan this QR code in your authenticator app, then enter the 6-digit code below.</p>
            {qr && <img src={qr} alt="MFA QR" className="mx-auto border rounded p-2 bg-white" />}
            {secret && (
              <p className="text-xs text-muted-foreground break-all text-center">
                Manual key: <code className="font-mono">{secret}</code>
              </p>
            )}
            <div>
              <Label>Verification code</Label>
              <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-4 text-sm">
            <ShieldCheck className="h-10 w-10 text-green-600 mx-auto mb-2" />
            Two-factor authentication is now active.
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === "intro" && (
            <>
              <Button variant="ghost" onClick={snooze}>Remind me later</Button>
              <Button onClick={startEnrol} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <KeyRound className="h-4 w-4 mr-2" /> Set up now
              </Button>
            </>
          )}
          {step === "verify" && (
            <>
              <Button variant="ghost" onClick={snooze}>Cancel</Button>
              <Button onClick={verify} disabled={loading || code.length !== 6}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Verify & enable
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
