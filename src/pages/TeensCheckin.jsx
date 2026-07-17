import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Clock, XCircle, LogOut, User, Mail, CheckCheck, UserCircle2, ShieldCheck, ShieldAlert } from "lucide-react";

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
  no_consent: "Parental consent required. A parent needs to open My Family → Teenagers, edit this teen, tick “I give parental consent”, and Save. Then try again.",
  not_authorised: "You aren't authorised to check this teen in. Ask a parent to sign in, or enter the teen's PIN.",
  not_enrolled: "You haven't set up self check-in yet. Tap 'I'm a teen' to enroll.",
  bad_pin: "That PIN doesn't match. Try again.",
  rate_limited: "Too many requests. Try again later.",
  expired: "This request expired. Please start again.",
  not_approved: "A worker hasn't approved you yet.",
  invalid_pin: "PIN must be 4-6 digits.",
};

// mode: 'choose' | 'parent' | 'parent-pin' | 'self-pick' | 'self-pin' | 'self-wait' | 'self-setpin'
export default function TeensCheckin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [session, setSession] = useState(null);
  const [teens, setTeens] = useState([]); // parent view (full)
  const [publicTeens, setPublicTeens] = useState([]); // self view (id, name, has_self_pin)
  const [openIds, setOpenIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pendingTeen, setPendingTeen] = useState(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("choose");

  // magic-link (guardian sign-in)
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSending, setMagicSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState(null);

  // self-enrolment
  const [selfTeen, setSelfTeen] = useState(null); // { id, first_name, last_name, has_self_pin }
  const [enrolmentId, setEnrolmentId] = useState(null);
  const [enrolStatus, setEnrolStatus] = useState(null); // pending / approved / rejected / expired / used
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const pollRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: sRows, error: sErr } = await supabase
        .rpc("get_teen_session_by_token", { _qr_token: token });
      if (!active) return;
      const s = Array.isArray(sRows) ? sRows[0] : sRows;
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

      // Fetch public teen list for self check-in
      const { data: pt } = await supabase.rpc("list_consented_teens_for_session", { _qr_token: token });
      if (active) setPublicTeens(pt || []);

      if (user) {
        const { data: teensData } = await supabase
          .from("teens")
          .select("id, first_name, last_name, access_pin_hash, primary_guardian_member_id, attendance_consent")
          .eq("tenant_id", s.tenant_id)
          .eq("is_active", true)
          .order("first_name");
        if (active) setTeens(teensData || []);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token, user, authLoading]);

  // Poll enrolment status
  useEffect(() => {
    if (!enrolmentId || enrolStatus === "approved" || enrolStatus === "used") return;
    pollRef.current = setInterval(async () => {
      const { data } = await supabase.rpc("teen_self_check_enrolment", { _enrolment_id: enrolmentId });
      if (data?.ok) setEnrolStatus(data.status);
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [enrolmentId, enrolStatus]);

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

  const doSelfCheckin = async (teenId, withPin) => {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("teen_self_checkin", {
      _qr_token: token,
      _teen_id: teenId,
      _pin: withPin,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    if (data?.ok) { setResult(data); setPin(""); }
    else { setError(data?.error || "unknown"); }
  };

  const requestEnrolment = async (teen) => {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("teen_self_request_enrolment", {
      _qr_token: token,
      _teen_id: teen.id,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    if (!data?.ok) { setError(data?.error || "unknown"); return; }
    setSelfTeen(teen);
    setEnrolmentId(data.enrolment_id);
    setEnrolStatus("pending");
    setMode("self-wait");
  };

  const submitNewPin = async () => {
    if (newPin.length < 4 || newPin !== newPin2) {
      setError("invalid_pin");
      return;
    }
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc("teen_self_set_pin", {
      _enrolment_id: enrolmentId,
      _pin: newPin,
    });
    if (rpcErr || !data?.ok) {
      setBusy(false);
      setError(rpcErr?.message || data?.error || "unknown");
      return;
    }
    // Immediately check them in
    await doSelfCheckin(selfTeen.id, newPin);
    setBusy(false);
  };

  const resetSelfFlow = () => {
    setSelfTeen(null); setEnrolmentId(null); setEnrolStatus(null);
    setNewPin(""); setNewPin2(""); setPin("");
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
                <Button variant="outline" className="w-full" onClick={() => { setResult(null); setPendingTeen(null); resetSelfFlow(); setMode("choose"); }}>
                  Check in another
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>Done</Button>
              </>
            );
          })()}

          {!result && error && error === "no_consent" && (
            <>
              <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
              <p className="text-base font-semibold">Parental consent required</p>
              <p className="text-sm text-muted-foreground">
                A parent needs to open <span className="font-medium">My Family → Teenagers</span>, edit this teen, tick
                {" "}<span className="font-medium">“I give parental consent”</span>, and Save. Then try again.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setError(null)}>Back</Button>
                {user && (
                  <Button className="flex-1" onClick={() => navigate("/my-family")}>Open My Family</Button>
                )}
              </div>
            </>
          )}

          {!result && error && error !== "no_consent" && (
            <>
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <p className="text-sm">{ERROR_MESSAGES[error] || error}</p>
              <Button variant="outline" className="w-full" onClick={() => setError(null)}>Back</Button>
            </>
          )}

          {/* Root chooser: not signed in and haven't chosen */}
          {!result && !error && !user && !magicSent && mode === "choose" && (
            <div className="space-y-3">
              <UserCircle2 className="h-12 w-12 mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Who's checking in?</p>
              <Button className="w-full" onClick={() => setMode("self-pick")}>
                I'm a teen (self check-in)
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setMode("parent")}>
                <Mail className="h-4 w-4 mr-1" /> Parent — email me a link
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode("parent-pin")}>
                Use parent-set PIN
              </Button>
            </div>
          )}

          {/* Parent magic link */}
          {!result && !error && !user && !magicSent && mode === "parent" && (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!magicEmail || !/^\S+@\S+\.\S+$/.test(magicEmail)) { setMagicError("Please enter a valid email address."); return; }
              setMagicSending(true); setMagicError(null);
              const redirectTo = `${window.location.origin}/teens/checkin/${token}`;
              const { error: err } = await supabase.auth.signInWithOtp({
                email: magicEmail.trim().toLowerCase(),
                options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
              });
              setMagicSending(false);
              if (err) { setMagicError(err.message); return; }
              setMagicSent(true);
            }} className="space-y-3 text-left">
              <Mail className="h-12 w-12 mx-auto text-primary" />
              <p className="text-sm text-center">Parents: we'll email a one-time sign-in link.</p>
              <div className="space-y-1.5">
                <Label htmlFor="magic-email">Parent's email</Label>
                <Input id="magic-email" type="email" autoComplete="email" inputMode="email" required
                  value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              {magicError && <p className="text-xs text-red-600">{magicError}</p>}
              <Button type="submit" className="w-full" disabled={magicSending}>
                {magicSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Email me a sign-in link
              </Button>
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setMode("choose")}>Back</Button>
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

          {/* Parent-set PIN (existing flow, no sign-in) */}
          {!result && !error && !user && mode === "parent-pin" && (
            <div className="space-y-3 text-left">
              <p className="text-sm text-center text-muted-foreground">Enter the teen's parent-set PIN.</p>
              <div className="space-y-1.5">
                <Label>Teen</Label>
                <select className="w-full border rounded-md h-10 px-3 text-sm"
                  value={pendingTeen?.id || ""}
                  onChange={(e) => {
                    const t = publicTeens.find((x) => x.id === e.target.value);
                    setPendingTeen(t ? { id: t.id } : null);
                  }}>
                  <option value="">Select a teen…</option>
                  {publicTeens.map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>PIN</Label>
                <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setPendingTeen(null); setPin(""); setMode("choose"); }}>Back</Button>
                <Button className="flex-1" disabled={busy || !pendingTeen?.id || pin.length < 4}
                  onClick={() => doCheckin(pendingTeen.id, pin)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in / out"}
                </Button>
              </div>
            </div>
          )}

          {/* Self: pick teen */}
          {!result && !error && mode === "self-pick" && (
            <div className="space-y-3 text-left">
              <p className="text-sm text-center text-muted-foreground">Tap your name.</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {publicTeens.length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-left">
                    <p className="text-xs font-semibold text-amber-900">No teens are eligible to check in yet.</p>
                    <p className="text-[11px] text-amber-800 mt-1">
                      Teens only appear here after a parent gives attendance consent in
                      {" "}<span className="font-medium">My Family → Teenagers</span>.
                    </p>
                  </div>
                )}
                {publicTeens.map((t) => (
                  <button key={t.id} type="button"
                    className="w-full flex items-center gap-3 border rounded-lg p-3 hover:bg-muted text-left"
                    onClick={() => {
                      if (t.has_self_pin) { setSelfTeen(t); setMode("self-pin"); }
                      else { requestEnrolment(t); }
                    }}>
                    <User className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm font-medium flex-1">{t.first_name} {t.last_name}</span>
                    {!t.has_self_pin && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">First time</span>}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("choose")}>Back</Button>
            </div>
          )}

          {/* Self: PIN entry (already enrolled) */}
          {!result && !error && mode === "self-pin" && selfTeen && (
            <div className="space-y-3 text-left">
              <p className="text-sm text-center">Hi {selfTeen.first_name}! Enter your PIN.</p>
              <div className="space-y-1.5">
                <Label>Your 4-digit PIN</Label>
                <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" autoFocus />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { resetSelfFlow(); setMode("self-pick"); }}>Back</Button>
                <Button className="flex-1" disabled={busy || pin.length < 4}
                  onClick={() => doSelfCheckin(selfTeen.id, pin)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check in / out"}
                </Button>
              </div>
            </div>
          )}

          {/* Self: waiting for worker approval */}
          {!result && !error && mode === "self-wait" && selfTeen && (
            <div className="space-y-3">
              {enrolStatus === "approved" || enrolStatus === "used" ? (
                <>
                  <ShieldCheck className="h-12 w-12 mx-auto text-green-600" />
                  <p className="text-sm font-semibold">Approved! Set your PIN</p>
                  <p className="text-xs text-muted-foreground">Choose a 4-digit PIN. You'll use it next time to check in.</p>
                  <div className="space-y-1.5 text-left">
                    <Label>New 4-digit PIN</Label>
                    <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <Label>Confirm PIN</Label>
                    <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={newPin2}
                      onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                  </div>
                  <Button className="w-full" disabled={busy || newPin.length < 4 || newPin !== newPin2} onClick={submitNewPin}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save PIN & check in"}
                  </Button>
                </>
              ) : enrolStatus === "rejected" ? (
                <>
                  <XCircle className="h-12 w-12 mx-auto text-red-500" />
                  <p className="text-sm">A worker declined your request.</p>
                  <Button variant="outline" className="w-full" onClick={() => { resetSelfFlow(); setMode("self-pick"); }}>Back</Button>
                </>
              ) : enrolStatus === "expired" ? (
                <>
                  <Clock className="h-12 w-12 mx-auto text-amber-500" />
                  <p className="text-sm">Your request expired.</p>
                  <Button variant="outline" className="w-full" onClick={() => { resetSelfFlow(); setMode("self-pick"); }}>Try again</Button>
                </>
              ) : (
                <>
                  <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                  <p className="text-sm font-semibold">Ask a Teens Church worker</p>
                  <p className="text-xs text-muted-foreground">
                    Show this screen to a worker. They'll tap <span className="font-medium">Approve</span> on their device.
                  </p>
                  <p className="text-sm">{selfTeen.first_name} {selfTeen.last_name}</p>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => { resetSelfFlow(); setMode("self-pick"); }}>Cancel</Button>
                </>
              )}
            </div>
          )}

          {/* Signed-in guardian: existing flow */}
          {!result && !error && user && !pendingTeen && (
            <>
              <p className="text-sm text-muted-foreground">Tap the teen to check in / out.</p>
              {teens.some((t) => !t.attendance_consent) && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-left space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900">Parental consent needed</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        You haven't given attendance consent for
                        {" "}<span className="font-medium">
                          {teens.filter((t) => !t.attendance_consent).map((t) => `${t.first_name} ${t.last_name}`).join(", ")}
                        </span>. They can't check in until consent is ticked.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" className="w-full" onClick={() => navigate("/my-family")}>
                    Manage consent
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {teens.length === 0 && (
                  <p className="text-xs text-muted-foreground">No registered teens found on your account.</p>
                )}
                {teens.map((t) => (
                  <button key={t.id} type="button"
                    className="w-full flex items-center gap-3 border rounded-lg p-3 hover:bg-muted text-left disabled:opacity-60 disabled:cursor-not-allowed"
                    onClick={() => doCheckin(t.id)}
                    disabled={busy || !t.attendance_consent}
                    title={!t.attendance_consent ? "Parent consent required" : undefined}>
                    <User className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm font-medium flex-1">{t.first_name} {t.last_name}</span>
                    {!t.attendance_consent && (
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">No consent</span>
                    )}
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

          {!result && !error && user && pendingTeen && (
            <div className="space-y-3 text-left">
              <p className="text-sm text-center text-muted-foreground">
                Ask a parent for the teen's PIN, then pick the teen.
              </p>
              <div className="space-y-1.5">
                <Label>Teen</Label>
                <select className="w-full border rounded-md h-10 px-3 text-sm"
                  value={pendingTeen.id}
                  onChange={(e) => {
                    const t = teens.find((x) => x.id === e.target.value);
                    setPendingTeen(t ? { id: t.id, first_name: t.first_name } : { id: "", first_name: "" });
                  }}>
                  <option value="">Select a teen…</option>
                  {teens.filter((t) => !!t.access_pin_hash).map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>4-digit PIN</Label>
                <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setPendingTeen(null); setPin(""); }}>Cancel</Button>
                <Button className="flex-1" disabled={busy || !pendingTeen.id || pin.length < 4}
                  onClick={() => doCheckin(pendingTeen.id, pin)}>
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
