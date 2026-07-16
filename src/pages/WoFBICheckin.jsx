import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Clock, XCircle, LogIn, LogOut } from "lucide-react";

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

  const handleLogin = () => {
    const returnTo = `/wofbi/checkin/${token}`;
    navigate(`/auth?redirect=${encodeURIComponent(returnTo)}`);
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
          {state.result && (
            <>
              {state.result.status === "late" ? (
                <Clock className="h-12 w-12 mx-auto text-amber-500" />
              ) : (
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
              )}
              <div>
                <p className="text-lg font-semibold">
                  You're checked in {state.result.status === "late" ? "(Late)" : ""}
                </p>
                <p className="text-sm text-muted-foreground">{state.result.session_title}</p>
                <p className="text-xs text-muted-foreground">{state.result.session_date}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Done</Button>
            </>
          )}
          {state.error === "not_authenticated" && (
            <>
              <LogIn className="h-12 w-12 mx-auto text-primary" />
              <p className="text-sm">Please sign in to check in.</p>
              <Button className="w-full" onClick={handleLogin}>Sign in</Button>
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
