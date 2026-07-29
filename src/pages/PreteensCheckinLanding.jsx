import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, XCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function PreteensCheckinLanding() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("list_open_preteen_sessions", { _tenant_slug: tenantSlug });
      if (!active) return;
      const list = data || [];
      setSessions(list);
      setLoading(false);
      if (list.length === 1) {
        navigate(`/t/${tenantSlug}/preteens/checkin/${list[0].qr_token}`, { replace: true });
      }
    })();
    return () => { active = false; };
  }, [tenantSlug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center">No active check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center">
            <XCircle className="h-12 w-12 mx-auto text-slate-400" />
            <p className="text-sm text-muted-foreground">
              There's no open Preteens Church attendance session right now. Please wait for a leader
              to open one, then scan the code again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Choose a session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground text-center pb-2">
            More than one session is open. Tap the one you want to check into.
          </p>
          {sessions.map((s) => (
            <Button
              key={s.id}
              variant="outline"
              className="w-full h-auto py-3 justify-between"
              onClick={() => navigate(`/t/${tenantSlug}/preteens/checkin/${s.qr_token}`)}
            >
              <span className="flex items-start gap-2 text-left">
                <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>
                  <span className="block text-sm font-medium">{s.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {format(new Date(s.session_date), "EEE d MMM")}
                    {s.start_time ? ` · ${String(s.start_time).slice(0, 5)}` : ""}
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
