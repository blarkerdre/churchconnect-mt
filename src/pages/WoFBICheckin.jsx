import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Clock, XCircle, Mail, LogOut, CheckCheck } from "lucide-react";

function fmtDuration(mins) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const ERROR_MESSAGES = {
  not_authenticated: "Please sign in to check in.",
  invalid_token: "This check-in link is invalid.",
  session_closed: "This attendance session is closed.",
  not_a_member: "Your account isn't a member of this church.",
  not_on_roster: "You are not registered on this course.",
};

export default function WoFBICheckin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState({ loading: true, result: null, error: null });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ loading: false, result: null, error: "not_authenticated" });
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc("wofbi_checkin", { _qr_token: token });
      if (!active) return;
      if (error) {
        setState({ loading: false, result: null, error: error.message });
        return;
      }
      if (data?.ok) {
        setState({ loading: false, result: data, error: null });
      } else {
        setState({ loading: false, result: null, error: data?.error || "unknown" });
      }
    })();
    return () => { active = false; };
  }, [token, user, authLoading]);

  const [magicEmail, setMagicEmail] = useState("");
  const [magicSending, setMagicSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState(null);

  const handleSendMagicLink = async (e) => {
    e?.preventDefault?.();
    if (!magicEmail || !/^\S+@\S+\.\S+$/.test(magicEmail)) {
      setMagicError("Please enter a valid email address.");
      return;
    }
    setMagicSending(true);
    setMagicError(null);
    const redirectTo = `${window.location.origin}/wofbi/checkin/${token}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setMagicSending(false);
    if (error) {
      setMagicError(error.message);
      return;
    }
    setMagicSent(true);
  };

  if (authLoading || state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Bible School Check-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {state.result && (() => {
            const r = state.result;
            const isOut = r.action === "checked_out";
            const already = r.action === "already_checked_out";
            const Icon = isOut || already ? LogOut : (r.status === "late" ? Clock : CheckCircle2);
            const iconColor = isOut ? "text-blue-600" : already ? "text-slate-500" : (r.status === "late" ? "text-amber-500" : "text-green-600");
            const title = isOut
              ? "Time-out recorded"
              : already
                ? "Already checked out"
                : `Time-in recorded${r.status === "late" ? " (Late)" : ""}`;
            return (
              <>
                <Icon className={`h-12 w-12 mx-auto ${iconColor}`} />
                <div>
                  <p className="text-lg font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{r.session_title}</p>
                  <p className="text-xs text-muted-foreground">{r.session_date}</p>
                  {(isOut || already) && r.duration_minutes != null && (
                    <p className="mt-2 text-sm">Time on premises: <span className="font-semibold">{fmtDuration(r.duration_minutes)}</span></p>
                  )}
                  {!isOut && !already && (
                    <p className="mt-2 text-xs text-muted-foreground">Scan again when you leave to record your time-out.</p>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Done</Button>
              </>
            );
          })()}
          {state.error === "not_authenticated" && !magicSent && (
            <form onSubmit={handleSendMagicLink} className="space-y-3 text-left">
              <Mail className="h-12 w-12 mx-auto text-primary" />
              <p className="text-sm text-center">
                Enter your email to receive a one-time sign-in link. No password needed.
              </p>
              <p className="text-xs text-center text-muted-foreground">
                Use the same email you registered with.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="magic-email">Email</Label>
                <Input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {magicError && <p className="text-xs text-red-600">{magicError}</p>}
              <Button type="submit" className="w-full" disabled={magicSending}>
                {magicSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Email me a sign-in link
              </Button>
            </form>
          )}
          {state.error === "not_authenticated" && magicSent && (
            <>
              <CheckCheck className="h-12 w-12 mx-auto text-green-600" />
              <p className="text-sm font-semibold">Check your email</p>
              <p className="text-xs text-muted-foreground">
                We sent a sign-in link to <span className="font-medium">{magicEmail}</span>. Open it
                on this device to complete check-in.
              </p>
            </>
          )}
          {state.error && state.error !== "not_authenticated" && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <p className="text-sm">{ERROR_MESSAGES[state.error] || state.error}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Back</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
