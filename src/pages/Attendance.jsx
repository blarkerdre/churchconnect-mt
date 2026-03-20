import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, Users, CalendarCheck, Plus, Loader2, Lock, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Attendance() {
  const { isAdmin, isUnitLeader } = useAuth();
  const canManage = isAdmin || isUnitLeader;
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", session_type: "Sunday Service", session_date: "", notes: "" });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["attendance-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_sessions").select("*").order("session_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const selectedSession = sessions.find(s => s.id === selectedSessionId) || sessions[0];

  const { data: records = [] } = useQuery({
    queryKey: ["attendance-records", selectedSession?.id],
    enabled: !!selectedSession?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, members(first_name, last_name)")
        .eq("session_id", selectedSession.id)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: totalMembers = 0 } = useQuery({
    queryKey: ["total-members-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("members").select("*", { count: "exact", head: true }).eq("membership_status", "Active");
      if (error) throw error;
      return count || 0;
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async (formData) => {
      const { error } = await supabase.from("attendance_sessions").insert({
        title: formData.title || null,
        session_type: formData.session_type,
        session_date: formData.session_date,
        notes: formData.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      toast({ title: "Session created" });
      setDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const closeSessionMutation = useMutation({
    mutationFn: async (sessionId) => {
      const { error } = await supabase.from("attendance_sessions").update({ status: "closed" }).eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      toast({ title: "Session closed" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const presentCount = records.length;
  const attendanceRate = totalMembers > 0 ? Math.round((presentCount / totalMembers) * 100) : 0;
  const isClosed = selectedSession?.status === "closed";

  const generateReport = () => {
    if (!selectedSession) return;
    const reportContent = [
      `ATTENDANCE REPORT`,
      `=================`,
      `Session: ${selectedSession.title || selectedSession.session_type}`,
      `Type: ${selectedSession.session_type}`,
      `Date: ${selectedSession.session_date}`,
      `Status: ${isClosed ? "Closed" : "Open"}`,
      ``,
      `Total Check-ins: ${presentCount}`,
      `Total Active Members: ${totalMembers}`,
      `Attendance Rate: ${attendanceRate}%`,
      ``,
      `ATTENDEES:`,
      `----------`,
      ...records.map((r, i) => `${i + 1}. ${r.members?.first_name || ""} ${r.members?.last_name || ""} — ${r.check_in_method || "manual"} — ${r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString() : "N/A"}`),
    ].join("\n");

    const blob = new Blob([reportContent], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-report-${selectedSession.session_date}.txt`;
    a.click();
    toast({ title: "Report downloaded" });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{presentCount}</p><p className="text-xs text-muted-foreground">Checked In</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{totalMembers}</p><p className="text-xs text-muted-foreground">Total Members</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{attendanceRate}%</p><p className="text-xs text-muted-foreground">Rate</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{sessions.length}</p><p className="text-xs text-muted-foreground">Sessions</p></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {sessions.length > 0 && (
          <Select value={selectedSession?.id || ""} onValueChange={setSelectedSessionId}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select session" /></SelectTrigger>
            <SelectContent>
              {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.title || s.session_type} – {s.session_date}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {selectedSession && (
          <>
            <Badge className={`border-0 ${isClosed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
              {isClosed ? "Closed" : selectedSession.session_type}
            </Badge>
            {isClosed && <Badge className="border-0 bg-destructive/10 text-destructive"><Lock className="h-3 w-3 mr-1" /> Closed</Badge>}
          </>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {selectedSession && (
            <Button variant="outline" size="sm" onClick={generateReport}>
              <FileText className="h-4 w-4 mr-2" /> Report
            </Button>
          )}
          {canManage && selectedSession && !isClosed && (
            <Button variant="outline" size="sm" onClick={() => {
              if (window.confirm("Close this session? No more check-ins will be allowed.")) {
                closeSessionMutation.mutate(selectedSession.id);
              }
            }} className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <Lock className="h-4 w-4 mr-2" /> Close Session
            </Button>
          )}
          {canManage && (
            <Button onClick={() => { setForm({ title: "", session_type: "Sunday Service", session_date: "", notes: "" }); setDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" /> New Session
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-accent" /> All Sessions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions yet</p>
              ) : sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedSession?.id === s.id ? "bg-primary/10 border border-primary/20" : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm text-foreground flex items-center gap-2">
                      {s.title || s.session_type}
                      {s.status === "closed" && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.session_type} · {s.session_date}</p>
                  </div>
                  <Badge variant="outline" className={`text-xs ${s.status === "closed" ? "text-muted-foreground" : "text-chart-3"}`}>
                    {s.status === "closed" ? "Closed" : "Open"}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Check-ins</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No check-ins for this session</p>
              ) : records.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {r.members?.first_name?.[0]}{r.members?.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.members?.first_name} {r.members?.last_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString() : "—"}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-chart-3/10 text-chart-3 border-0">{r.check_in_method || "manual"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">New Session</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Title (optional)</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.session_type} onValueChange={v => setForm(f => ({ ...f, session_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Sunday Service", "Midweek Service", "Special Program", "Unit Meeting", "WSF Meeting", "Other"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={form.session_date} onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={() => createSessionMutation.mutate(form)} disabled={createSessionMutation.isPending} className="w-full bg-primary">
              {createSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
