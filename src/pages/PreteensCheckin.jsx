import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Clock, XCircle, LogOut, User, Mail, CheckCheck, UserCircle2, ShieldCheck, ShieldAlert } from "lucide-react";
import welcome1 from "@/assets/preteens-checkin/welcome-1.jpg";
import welcome2 from "@/assets/preteens-checkin/welcome-2.jpg";
import welcome3 from "@/assets/preteens-checkin/welcome-3.jpg";
import welcome4 from "@/assets/preteens-checkin/welcome-4.jpg";
import farewell1 from "@/assets/preteens-checkin/farewell-1.jpg";
import farewell2 from "@/assets/preteens-checkin/farewell-2.jpg";
import farewell3 from "@/assets/preteens-checkin/farewell-3.jpg";

const WELCOME_IMAGES = [welcome1, welcome2, welcome3, welcome4];
const FAREWELL_IMAGES = [farewell1, farewell2, farewell3];
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

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
  invalid_preteen: "That preteen isn't registered here.",
  no_consent: "Parental consent required. A parent needs to open My Family → Prepreteenagers, edit this preteen, tick “I give parental consent”, and Save. Then try again.",
  not_authorised: "You aren't authorised to check this preteen in. Ask a parent to sign in, or enter the preteen's PIN.",
  not_enrolled: "You haven't set up self check-in yet. Tap 'I'm a preteen' to enroll.",
  bad_pin: "That PIN doesn't match. Try again.",
  rate_limited: "Too many requests. Try again later.",
  expired: "This request expired. Please start again.",
  not_approved: "A worker hasn't approved you yet.",
  invalid_pin: "PIN must be 4-6 digits.",
};

// mode: 'choose' | 'parent' | 'parent-pin' | 'self-pick' | 'self-pin' | 'self-wait' | 'self-setpin'
export default function PrepreteensCheckin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [session, setSession] = useState(null);
  const [preteens, setPrepreteens] = useState([]); // parent view (full)
  const [publicPrepreteens, setPublicPrepreteens] = useState([]); // self view (id, name, has_self_pin)
  const [openIds, setOpenIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pendingPrepreteen, setPendingPrepreteen] = useState(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("choose");
  const [closedMsg, setClosedMsg] = useState(false);

  const successImage = useMemo(() => {
    if (!result) return null;
    const isFarewell = result.action === "checked_out" || result.action === "already_checked_out";
    return pickRandom(isFarewell ? FAREWELL_IMAGES : WELCOME_IMAGES);
  }, [result]);

  const handleClose = () => {
    try { window.close(); } catch { /* noop */ }
    setTimeout(() => setClosedMsg(true), 150);
  };


  // magic-link (guardian sign-in)
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSending, setMagicSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState(null);

  // self-enrolment
  const [selfPrepreteen, setSelfPrepreteen] = useState(null); // { id, first_name, last_name, has_self_pin }
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
        .rpc("get_preteen_session_by_token", { _qr_token: token });
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

      // Fetch public preteen list for self check-in
      const { data: pt } = await supabase.rpc("list_consented_preteens_for_session", { _qr_token: token });
      if (active) setPublicPrepreteens(pt || []);

      if (user) {
        const { data: preteensData } = await supabase
          .from("preteens")
          .select("id, first_name, last_name, access_pin_hash, primary_guardian_member_id, attendance_consent")
          .eq("tenant_id", s.tenant_id)
          .eq("is_active", true)
          .order("first_name");
        if (active) setPrepreteens(preteensData || []);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [token, user, authLoading]);

  const refreshOpenIds = async () => {
    const { data } = await supabase.rpc("get_preteen_open_checkins", { _qr_token: token });
    setOpenIds(new Set((data || []).map((r) => r.preteen_id)));
  };

  useEffect(() => {
    if (!session || session.status !== "open") return;
    refreshOpenIds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Poll enrolment status
  useEffect(() => {
    if (!enrolmentId || enrolStatus === "approved" || enrolStatus === "used") return;
    pollRef.current = setInterval(async () => {
      const { data } = await supabase.rpc("preteen_self_check_enrolment", { _enrolment_id: enrolmentId });
      if (data?.ok) setEnrolStatus(data.status);
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, [enrolmentId, enrolStatus]);

  const isCheckedIn = (id) => openIds.has(id);

  const doCheckin = async (preteenId, withPin) => {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("preteen_checkin", {
      _qr_token: token,
      _preteen_id: preteenId,
      _pin: withPin || null,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    if (data?.ok) { setResult(data); setPendingPrepreteen(null); setPin(""); refreshOpenIds(); }
    else { setError(data?.error || "unknown"); }
  };

  const doSelfCheckin = async (preteenId, withPin) => {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("preteen_self_checkin", {
      _qr_token: token,
      _preteen_id: preteenId,
      _pin: withPin,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    if (data?.ok) { setResult(data); setPin(""); refreshOpenIds(); }
    else { setError(data?.error || "unknown"); }
  };

  const requestEnrolment = async (preteen) => {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("preteen_self_request_enrolment", {
      _qr_token: token,
      _preteen_id: preteen.id,
    });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    if (!data?.ok) { setError(data?.error || "unknown"); return; }
    setSelfPrepreteen(preteen);
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
    const { data, error: rpcErr } = await supabase.rpc("preteen_self_set_pin", {
      _enrolment_id: enrolmentId,
      _pin: newPin,
    });
    if (rpcErr || !data?.ok) {
      setBusy(false);
      setError(rpcErr?.message || data?.error || "unknown");
      return;
    }
    // Immediately check them in
    await doSelfCheckin(selfPrepreteen.id, newPin);
    setBusy(false);
  };

  const resetSelfFlow = () => {
    setSelfPrepreteen(null); setEnrolmentId(null); setEnrolStatus(null);
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
          <CardTitle className="text-center">Prepreteens Check-in</CardTitle>
          {session && (
            <p className="text-center text-xs text-muted-foreground">
              {session.title} · {session.session_date}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {result && closedMsg && (
            <>
              <CheckCheck className="h-12 w-12 mx-auto text-green-600" />
              <p className="text-sm">You can close this tab now.</p>
            </>
          )}
          {result && !closedMsg && (() => {
            const isOut = result.action === "checked_out";
            const already = result.action === "already_checked_out" || result.action === "already_checked_in";
            const alreadyIn = result.action === "already_checked_in";
            const isFarewell = isOut || result.action === "already_checked_out";
            if (already) {
              const label = alreadyIn ? "Already checked in" : "Already checked out";
              const sub = alreadyIn
                ? "No change — this preteen is already signed in."
                : "No change — this preteen is already signed out.";
              return (
                <>
                  <CheckCheck className={`h-12 w-12 mx-auto ${alreadyIn ? "text-green-600" : "text-slate-500"}`} />
                  <div>
                    <p className="text-xl font-bold">{label}</p>
                    <p className="text-sm text-muted-foreground">{result.preteen_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => { setResult(null); setPendingPrepreteen(null); resetSelfFlow(); setMode("choose"); }}>
                    Back
                  </Button>
                  <Button className="w-full" onClick={handleClose}>Close</Button>
                </>
              );
            }
            const caption = isFarewell ? "See you next time!" : "Welcome to church!";
            const subCaption = isFarewell
              ? "Time-out recorded"
              : `Time-in recorded${result.status === "late" ? " (Late)" : ""}`;
            return (
              <>
                {successImage && (
                  <img
                    src={successImage}
                    alt={caption}
                    width={768}
                    height={512}
                    loading="lazy"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                )}
                <div>
                  <p className="text-xl font-bold">{caption}</p>
                  <p className="text-sm text-muted-foreground">{result.preteen_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{subCaption}</p>
                  {isFarewell && result.duration_minutes != null && (
                    <p className="mt-2 text-sm">Time on premises: <span className="font-semibold">{fmtDuration(result.duration_minutes)}</span></p>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setResult(null); setPendingPrepreteen(null); resetSelfFlow(); setMode("choose"); }}>
                  Check in another
                </Button>
                <Button className="w-full" onClick={handleClose}>Close</Button>
              </>
            );
          })()}

          {!result && error && error === "no_consent" && (
            <>
              <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
              <p className="text-base font-semibold">Parental consent required</p>
              <p className="text-sm text-muted-foreground">
                A parent needs to open <span className="font-medium">My Family → Prepreteenagers</span>, edit this preteen, tick
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
                I'm a preteen (self check-in)
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
              const redirectTo = `${window.location.origin}/preteens/checkin/${token}`;
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
              <p className="text-sm text-center text-muted-foreground">Enter the preteen's parent-set PIN.</p>
              <div className="space-y-1.5">
                <Label>Prepreteen</Label>
                <select className="w-full border rounded-md h-10 px-3 text-sm"
                  value={pendingPrepreteen?.id || ""}
                  onChange={(e) => {
                    const t = publicPrepreteens.find((x) => x.id === e.target.value);
                    setPendingPrepreteen(t ? { id: t.id } : null);
                  }}>
                  <option value="">Select a preteen…</option>
                  {publicPrepreteens.map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              </div>
              {pendingPrepreteen?.id && (
                <p aria-live="polite" className={`text-xs rounded-md px-2 py-1.5 ${isCheckedIn(pendingPrepreteen.id) ? "bg-green-50 text-green-800 border border-green-200" : "bg-slate-50 text-slate-700 border border-slate-200"}`}>
                  {isCheckedIn(pendingPrepreteen.id)
                    ? "Currently checked in — entering PIN will check them out."
                    : "Not checked in yet — entering PIN will check them in."}
                </p>
              )}
              <div className="space-y-1.5">
                <Label>PIN</Label>
                <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setPendingPrepreteen(null); setPin(""); setMode("choose"); }}>Back</Button>
                <Button className="flex-1" variant={isCheckedIn(pendingPrepreteen?.id) ? "destructive" : "default"}
                  disabled={busy || !pendingPrepreteen?.id || pin.length < 4}
                  onClick={() => doCheckin(pendingPrepreteen.id, pin)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isCheckedIn(pendingPrepreteen?.id) ? "Check out" : "Check in")}
                </Button>
              </div>
            </div>
          )}

          {/* Self: pick preteen */}
          {!result && !error && mode === "self-pick" && (
            <div className="space-y-3 text-left">
              <p className="text-sm text-center text-muted-foreground">Tap your name.</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {publicPrepreteens.length === 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-left">
                    <p className="text-xs font-semibold text-amber-900">No preteens are eligible to check in yet.</p>
                    <p className="text-[11px] text-amber-800 mt-1">
                      Prepreteens only appear here after a parent gives attendance consent in
                      {" "}<span className="font-medium">My Family → Prepreteenagers</span>.
                    </p>
                  </div>
                )}
                {publicPrepreteens.map((t) => {
                  const inNow = isCheckedIn(t.id);
                  return (
                    <button key={t.id} type="button"
                      className="w-full flex items-center gap-3 border rounded-lg p-3 hover:bg-muted text-left"
                      onClick={() => {
                        if (t.has_self_pin) { setSelfPrepreteen(t); setMode("self-pin"); }
                        else { requestEnrolment(t); }
                      }}>
                      <User className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm font-medium flex-1">{t.first_name} {t.last_name}</span>
                      <span aria-live="polite" className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${inNow ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                        {inNow ? "Checked in" : "Not checked in"}
                      </span>
                      {!t.has_self_pin && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">First time</span>}
                    </button>
                  );
                })}
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setMode("choose")}>Back</Button>
            </div>
          )}

          {/* Self: PIN entry (already enrolled) */}
          {!result && !error && mode === "self-pin" && selfPrepreteen && (
            <div className="space-y-3 text-left">
              <p className="text-sm text-center">Hi {selfPrepreteen.first_name}! Enter your PIN.</p>
              <p aria-live="polite" className={`text-xs rounded-md px-2 py-1.5 ${isCheckedIn(selfPrepreteen.id) ? "bg-green-50 text-green-800 border border-green-200" : "bg-slate-50 text-slate-700 border border-slate-200"}`}>
                {isCheckedIn(selfPrepreteen.id)
                  ? "You're currently checked in — entering your PIN will check you out."
                  : "You're not checked in yet — entering your PIN will check you in."}
              </p>
              <div className="space-y-1.5">
                <Label>Your 4-digit PIN</Label>
                <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" autoFocus />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { resetSelfFlow(); setMode("self-pick"); }}>Back</Button>
                <Button className="flex-1" variant={isCheckedIn(selfPrepreteen.id) ? "destructive" : "default"}
                  disabled={busy || pin.length < 4}
                  onClick={() => doSelfCheckin(selfPrepreteen.id, pin)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isCheckedIn(selfPrepreteen.id) ? "Check out" : "Check in")}
                </Button>
              </div>
            </div>
          )}

          {/* Self: waiting for worker approval */}
          {!result && !error && mode === "self-wait" && selfPrepreteen && (
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
                  <p className="text-sm font-semibold">Ask a Prepreteens Church worker</p>
                  <p className="text-xs text-muted-foreground">
                    Show this screen to a worker. They'll tap <span className="font-medium">Approve</span> on their device.
                  </p>
                  <p className="text-sm">{selfPrepreteen.first_name} {selfPrepreteen.last_name}</p>
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => { resetSelfFlow(); setMode("self-pick"); }}>Cancel</Button>
                </>
              )}
            </div>
          )}

          {/* Signed-in guardian: existing flow */}
          {!result && !error && user && !pendingPrepreteen && (
            <>
              <p className="text-sm text-muted-foreground">Tap <span className="font-medium">Check in</span> to sign a preteen in, or <span className="font-medium">Check out</span> when they're leaving.</p>
              {preteens.some((t) => !t.attendance_consent) && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-left space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-900">Parental consent needed</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        You haven't given attendance consent for
                        {" "}<span className="font-medium">
                          {preteens.filter((t) => !t.attendance_consent).map((t) => `${t.first_name} ${t.last_name}`).join(", ")}
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
                {preteens.length === 0 && (
                  <p className="text-xs text-muted-foreground">No registered preteens found on your account.</p>
                )}
                {preteens.map((t) => {
                  const out = isCheckedIn(t.id);
                  return (
                    <div key={t.id}
                      className="w-full flex items-center gap-3 border rounded-lg p-3">
                      <User className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm font-medium flex-1">{t.first_name} {t.last_name}</span>
                      {t.attendance_consent && (
                        <span aria-live="polite" className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${out ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                          {out ? "Checked in" : "Not checked in"}
                        </span>
                      )}
                      {!t.attendance_consent ? (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">No consent</span>
                      ) : (
                        <Button
                          size="sm"
                          variant={out ? "destructive" : "default"}
                          disabled={busy}
                          onClick={() => doCheckin(t.id)}
                        >
                          {out ? "Check out" : "Check in"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Not the parent? Ask them to sign in, or enter this preteen's PIN below.
              </p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setPendingPrepreteen({ id: "", first_name: "" })}>
                Use PIN instead
              </Button>
            </>
          )}

          {!result && !error && user && pendingPrepreteen && (
            <div className="space-y-3 text-left">
              <p className="text-sm text-center text-muted-foreground">
                Ask a parent for the preteen's PIN, then pick the preteen.
              </p>
              <div className="space-y-1.5">
                <Label>Prepreteen</Label>
                <select className="w-full border rounded-md h-10 px-3 text-sm"
                  value={pendingPrepreteen.id}
                  onChange={(e) => {
                    const t = preteens.find((x) => x.id === e.target.value);
                    setPendingPrepreteen(t ? { id: t.id, first_name: t.first_name } : { id: "", first_name: "" });
                  }}>
                  <option value="">Select a preteen…</option>
                  {preteens.filter((t) => !!t.access_pin_hash).map((t) => (
                    <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                  ))}
                </select>
              </div>
              {pendingPrepreteen.id && (
                <p aria-live="polite" className={`text-xs rounded-md px-2 py-1.5 ${isCheckedIn(pendingPrepreteen.id) ? "bg-green-50 text-green-800 border border-green-200" : "bg-slate-50 text-slate-700 border border-slate-200"}`}>
                  {isCheckedIn(pendingPrepreteen.id)
                    ? "Currently checked in — entering PIN will check them out."
                    : "Not checked in yet — entering PIN will check them in."}
                </p>
              )}
              <div className="space-y-1.5">
                <Label>4-digit PIN</Label>
                <Input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setPendingPrepreteen(null); setPin(""); }}>Cancel</Button>
                <Button className="flex-1" variant={isCheckedIn(pendingPrepreteen.id) ? "destructive" : "default"}
                  disabled={busy || !pendingPrepreteen.id || pin.length < 4}
                  onClick={() => doCheckin(pendingPrepreteen.id, pin)}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isCheckedIn(pendingPrepreteen.id) ? "Check out" : "Check in")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
