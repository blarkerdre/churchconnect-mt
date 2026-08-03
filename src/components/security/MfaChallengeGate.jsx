import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listTotpFactors, verifyTotp } from "@/hooks/useMfa";

/**
 * Full-screen second-factor challenge. Rendered instead of the app whenever the
 * signed-in account has a verified authenticator but the session is still aal1.
 */
export default function MfaChallengeGate() {
  const { signOut, refreshMfaStatus } = useAuth();
  const [factorId, setFactorId] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { verified } = await listTotpFactors();
        setFactorId(verified[0]?.id || null);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const submit = async () => {
    if (!factorId || code.trim().length !== 6) return;
    setBusy(true);
    setError("");
    try {
      await verifyTotp(factorId, code);
      await refreshMfaStatus();
    } catch (e) {
      setError(e.message || "That code was not accepted. Try the current code from your app.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <ShieldCheck className="h-5 w-5 text-primary" /> Two-step verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the current 6-digit code from your authenticator app to finish signing in.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Verification code</Label>
            <Input
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              placeholder="123456"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={submit} disabled={busy || code.length !== 6 || !factorId}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Verify
          </Button>
          <Button variant="ghost" className="w-full" onClick={signOut}>
            Sign out and use another account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
