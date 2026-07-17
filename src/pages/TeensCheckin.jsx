import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Clock, XCircle, LogOut, User, Mail, CheckCheck } from "lucide-react";

function fmtDuration(mins) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

const ERROR_MESSAGES = {
  invalid_token: "This check-in link is invalid.",
  session_closed: "This session is closed.",
  invalid_teen: "That teen isn't registered here.",
  no_consent: "A parent hasn't given attendance consent for this teen yet. Ask a parent to open My Family and tick the consent box.",
  not_authorised: "You aren't authorised to check this teen in. Ask a parent to sign in, or enter the teen's PIN.",
};

export default function TeensCheckin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [session, setSession] = useState(null);
  const [teens, setTeens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pendingTeen, setPendingTeen] = useState(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  // magic-link (guardian sign-in)
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSending, setMagicSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (async () => {
      setLoading(true);
      // Look up session by qr_token
      const { data: s, error: sErr } = await supabase
        .from("teen_attendance_sessions")
        .select("id,title,session_date,status,tenant_id")
        .eq("qr_token", token)
        .maybeSingle();
      if (!active) return;
      if (sErr || !s) {
        setError("invalid_token");
        setLoading(false);
        return;
      }
      setSession(s);
      if (s.status !== "open") {
        setError("session_closed");
        setLoading(false);
        return;
      }

      // If signed in as a guardian, load their teens
      if (user) {
        const { data: teensData } = await supabase
          .from("teens")
          .select("id, first_name, last_name, access_pin_hash, primary_guardian_member_id")
          .eq("tenant_id", s.tenant_id)
          .eq("is_active", true)
          .order("first_name");
        if (active) setTeens(teensData || []);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token, user, authLoading]);

  const doCheckin = async (teenId, withPin) => {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("teen_checkin", {
      _qr_token: token,
      _teen_id: teenId,
      _pin: withPin || null,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    if (data?.ok) { setResult(data); setPendingTeen(null); setPin(""); }
    else { setError(data?.error || "unknown"); }
  };

  const handleSendMagicLink = async (e) => {
    e?.preventDefault?.();
    if (!magicEmail || !/^\S+@\S+\.\S+$/.test(magicEmail)) {
      setMagicError("Please enter a valid email address.");
      return;
    }
    setMagicSending(true);
    setMagicError(null);
    const redirectTo = `${window.location.origin}/teens/checkin/${token}`;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    setMagicSending(false);
    if (err) { setMagicError(err.message); return; }
    setMagicSent(true);
  };

  if (authLoading || loading) {
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
          <CardTitle className="text-center">Teens Check-in</CardTitle>
          {session && (
            <p className="text-center text-xs text-muted-foreground">
              {session.title} · {session.session_date}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {result && (() => {
            const isOut = result.action === "checked_out";
            const already = result.action === "already_checked_out";
            const Icon = isOut || already ? LogOut : (result.status === "late" ? Clock : CheckCircle2);
            const iconColor = isOut ? "text-blue-600" : already ? "text-slate-500" : (result.status === "late" ? "text-amber-500" : "text-green-600");
            const title = isOut
              ? "Time-out recorded"
              : already
                ? "Already checked out"
                : `Time-in recorded${result.status === "late" ? " (Late)" : ""}`;
            return (
              <>
                <Icon className={`h-12 w-12 mx-auto ${iconColor}`} />
                <div>
                  <p className="text-lg font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{result.teen_name}</p>
                  {(isOut || already) && result.duration_minutes != null && (
                    <p className="mt-2 text-sm">Time on premises: <span className="font-semibold">{fmtDuration(result.duration_minutes)}</span></p>
                  )}
                  {!isOut && !already && (
                    <p className="mt-2 text-xs text-muted-foreground">Scan again when leaving to record time-out.</p>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setResult(null); setPendingTeen(null); }}>
                  Check in another teen
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>Done</Button>
              </>
            );
          })()}

          {!result && error && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <p className="text-sm">{ERROR_MESSAGES[error] || error}</p>
              <Button variant="outline" className="w-full" onClick={() => setError(null)}>Back</Button>
            </>
          )}

          {!result && !error && !user && !magicSent && (
            <form onSubmit={handleSendMagicLink} className="space-y-3 text-left">
              <Mail className="h-12 w-12 mx-auto text-primary" />
              <p className="text-sm text-center">
                Parents: sign in to check your teen in. We'll email you a one-time link — no password.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="magic-email">Parent's email</Label>
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

          {!result && !error && !user && magicSent && (
            <>
              <CheckCheck className="h-12 w-12 mx-auto text-green-600" />
              <p className="text-sm font-semibold">Check your email</p>
              <p className="text-xs text-muted-foreground">
                We sent a sign-in link to <span className="font-medium">{magicEmail}</span>. Open it on this device to continue.
              </p>
            </>
          )}

          {!result && !error && user && !pendingTeen && (
            <>
              <p className="text-sm text-muted-foreground">Tap the teen to check in / out.</p>
              <div className="space-y-2">
                {teens.length === 0 && (
                  <p className="text-xs text-muted-foreground">No registered teens found on your account.</p>
                )}
                {teens.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full flex items-center gap-3 border rounded-lg p-3 hover:bg-muted text-left"
                    onClick={() => doCheckin(t.id)}
                    disabled={busy}
                  >
                    <User className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm font-medium">{t.first_name} {t.last_name}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Not the parent? Ask them to sign in, or enter this teen's PIN below.
              </p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setPendingTeen({ id: "", first_name: "" })}>
                Use PIN instead
              </Button>
            </>
          )}

          {!result && !error && pendingTeen && (
            <div className="space-y-3 text-left">
              <p className="text-sm text-center text-muted-foreground">
                Ask a parent for the teen's 4-digit PIN, then pick the teen.
              </p>
              <div className="space-y-1.5">
                <Label>Teen</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 text-sm"
                  value={pendingTeen.id}
                  onChange={(e) => {
                    const t = teens.find((x) => x.id === e.target.value);
                    setPendingTeen(t ? { id: t.id, first_name: t.first_name } : { id: "", first_name: "" });
                  }}
                >
                  <option value="">Select a teen…</option>
                  {teens.filter((t) => !!t.access_pin_hash).map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>4-digit PIN</Label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setPendingTeen(null); setPin(""); }}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy || !pendingTeen.id || pin.length < 4}
                  onClick={() => doCheckin(pendingTeen.id, pin)}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in / out"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
