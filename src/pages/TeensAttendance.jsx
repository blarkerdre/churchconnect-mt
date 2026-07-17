import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, QrCode, Calendar, LogIn, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import TeenAttendanceQRDialog from "@/components/teens/TeenAttendanceQRDialog";

function fmtDuration(mins) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function NewSessionDialog({ open, onOpenChange, onCreated }) {
  const { user } = useAuth();
  const { tenantId, withTenant } = useTenantQuery();
  const [form, setForm] = useState({
    title: "Sunday Teens",
    session_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "10:00",
    end_time: "12:00",
    late_after: "10:15",
    notes: "",
  });
  const create = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.session_date) throw new Error("Title and date required");
      const payload = {
        title: form.title,
        session_date: form.session_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        late_after: form.late_after || null,
        notes: form.notes || null,
        status: "open",
        created_by: user?.id || null,
      };
      const { data, error } = await supabase.from("teen_attendance_sessions").insert(withTenant(payload)).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => { toast.success("Session created"); onCreated?.(s); onOpenChange(false); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Teens Session</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Date</Label><Input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
          </div>
          <div><Label>Late after</Label><Input type="time" value={form.late_after} onChange={(e) => setForm({ ...form, late_after: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !tenantId}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RosterDialog({ open, onOpenChange, session }) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();

  const { data: teens = [] } = useQuery({
    queryKey: ["all-teens", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("teens").select("id, first_name, last_name")
        .eq("tenant_id", tenantId).eq("is_active", true).order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["teen-records", session?.id],
    enabled: !!session?.id && open,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.from("teen_attendance_records").select("*").eq("session_id", session.id);
      if (error) throw error;
      return data || [];
    },
  });

  const recMap = useMemo(() => {
    const m = new Map();
    (records || []).forEach((r) => m.set(r.teen_id, r));
    return m;
  }, [records]);

  const signAction = useMutation({
    mutationFn: async (teenId) => {
      const { data, error } = await supabase.rpc("teen_checkin", {
        _qr_token: session.qr_token,
        _teen_id: teenId,
        _pin: null,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Failed");
      return data;
    },
    onSuccess: (d) => {
      toast.success(d.action === "checked_out" ? "Signed out" : d.action === "already_checked_out" ? "Already checked out" : "Signed in");
      qc.invalidateQueries({ queryKey: ["teen-records", session.id] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session?.title} — Roster</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {teens.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No teens registered yet.</p>}
          {teens.map((t) => {
            const r = recMap.get(t.id);
            const state = !r ? "out" : (r.checked_out_at ? "left" : "in");
            return (
              <div key={t.id} className="flex items-center justify-between border rounded-lg p-2">
                <div>
                  <p className="text-sm font-medium">{t.first_name} {t.last_name}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {state === "in" && <Badge className="bg-green-600 text-white">In · {format(new Date(r.checked_in_at), "HH:mm")}{r.status === "late" ? " (late)" : ""}</Badge>}
                    {state === "left" && <Badge variant="secondary">Left · {fmtDuration(r.duration_minutes)}</Badge>}
                    {state === "out" && <Badge variant="outline">Not in</Badge>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {state === "out" && (
                    <Button size="sm" onClick={() => signAction.mutate(t.id)} disabled={signAction.isPending}>
                      <LogIn className="h-4 w-4 mr-1" /> In
                    </Button>
                  )}
                  {state === "in" && (
                    <Button size="sm" variant="secondary" onClick={() => signAction.mutate(t.id)} disabled={signAction.isPending}>
                      <LogOut className="h-4 w-4 mr-1" /> Out
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TeensAttendance() {
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [rosterSession, setRosterSession] = useState(null);

  const { data: sessions = [], refetch } = useQuery({
    queryKey: ["teen-sessions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("teen_attendance_sessions").select("*")
        .eq("tenant_id", tenantId).order("session_date", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Teens Attendance</h1>
          <p className="text-sm text-muted-foreground">On-premise check-in / check-out for registered teens.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> New session</Button>
      </div>

      <div className="space-y-3">
        {sessions.length === 0 && (
          <Card><CardContent className="p-8 text-sm text-muted-foreground text-center">No teens sessions yet.</CardContent></Card>
        )}
        {sessions.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {s.title}</span>
                {s.status === "open" ? <Badge className="bg-green-600 text-white">Open</Badge> : <Badge variant="secondary">Closed</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {format(new Date(s.session_date), "EEE d MMM yyyy")}
                {s.start_time ? ` · ${s.start_time?.slice(0,5)}` : ""}
                {s.end_time ? ` – ${s.end_time?.slice(0,5)}` : ""}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setQrSession(s)} disabled={s.status !== "open"}>
                  <QrCode className="h-4 w-4 mr-1" /> Show QR
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRosterSession(s)}>
                  <Users className="h-4 w-4 mr-1" /> Roster / manual sign in-out
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <NewSessionDialog open={newOpen} onOpenChange={setNewOpen} onCreated={() => { refetch(); qc.invalidateQueries({ queryKey: ["teen-sessions"] }); }} />
      {qrSession && (
        <TeenAttendanceQRDialog
          open={!!qrSession}
          onOpenChange={(o) => !o && setQrSession(null)}
          session={qrSession}
          onClosed={() => { refetch(); setQrSession(null); }}
        />
      )}
      {rosterSession && (
        <RosterDialog open={!!rosterSession} onOpenChange={(o) => !o && setRosterSession(null)} session={rosterSession} />
      )}
    </div>
  );
}
