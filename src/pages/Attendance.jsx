import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, Users, CalendarCheck, Plus, Loader2, Lock, FileText, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ReportAttachments from "@/components/reports/ReportAttachments";

export default function Attendance() {
  const { isAdmin, isUnitLeader } = useAuth();
  const canManage = isAdmin || isUnitLeader;
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", session_type: "Sunday Service", session_date: "", notes: "", unit: "" });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [demoForm, setDemoForm] = useState({ male_count: 0, female_count: 0, meeting_notes: "" });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["attendance-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_sessions").select("*").order("session_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (dateFrom && s.session_date < dateFrom) return false;
      if (dateTo && s.session_date > dateTo) return false;
      return true;
    });
  }, [sessions, dateFrom, dateTo]);

  const selectedSession = filteredSessions.find(s => s.id === selectedSessionId) || filteredSessions[0];

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
        unit: formData.unit || null,
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

  const updateDemographicsMutation = useMutation({
    mutationFn: async ({ sessionId, male_count, female_count }) => {
      const total = male_count + female_count;
      const { error } = await supabase.from("attendance_sessions").update({ male_count, female_count, total_count: total }).eq("id", sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      toast({ title: "Demographics saved" });
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
      selectedSession.unit ? `Unit: ${selectedSession.unit}` : null,
      ``,
      `Demographics:`,
      `  Male: ${selectedSession.male_count || 0}`,
      `  Female: ${selectedSession.female_count || 0}`,
      `  Total: ${selectedSession.total_count || 0}`,
      ``,
      `Total Check-ins: ${presentCount}`,
      `Total Active Members: ${totalMembers}`,
      `Attendance Rate: ${attendanceRate}%`,
      ``,
      `ATTENDEES:`,
      `----------`,
      ...records.map((r, i) => `${i + 1}. ${r.members?.first_name || ""} ${r.members?.last_name || ""} — ${r.check_in_method || "manual"} — ${r.checked_in_at ? new Date(r.checked_in_at).toLocaleTimeString() : "N/A"}`),
    ].filter(Boolean).join("\n");

    const blob = new Blob([reportContent], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `attendance-report-${selectedSession.session_date}.txt`;
    a.click();
    toast({ title: "Report downloaded" });
  };

  const demoTotal = (parseInt(demoForm.male_count) || 0) + (parseInt(demoForm.female_count) || 0);

  // Sync demoForm when selected session changes
  React.useEffect(() => {
    if (selectedSession) {
      setDemoForm({ male_count: selectedSession.male_count || 0, female_count: selectedSession.female_count || 0 });
    }
  }, [selectedSession?.id]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-chart-3">{presentCount}</p><p className="text-xs text-muted-foreground">Checked In</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-foreground">{totalMembers}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-primary">{attendanceRate}%</p><p className="text-xs text-muted-foreground">Rate</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-accent">{filteredSessions.length}</p><p className="text-xs text-muted-foreground">Sessions</p></CardContent></Card>
      </div>

      {/* Date Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> Filter by date:
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm flex-1" placeholder="From" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm flex-1" placeholder="To" />
        </div>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs">Clear</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {filteredSessions.length > 0 && (
          <Select value={selectedSession?.id || ""} onValueChange={setSelectedSessionId}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select session" /></SelectTrigger>
            <SelectContent>
              {filteredSessions.map(s => <SelectItem key={s.id} value={s.id}>{s.title || s.session_type} – {s.session_date}</SelectItem>)}
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
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto">
          {selectedSession && (
            <Button variant="outline" size="sm" onClick={generateReport}>
              <FileText className="h-4 w-4" /><span className="hidden sm:inline ml-2">Report</span>
            </Button>
          )}
          {canManage && selectedSession && !isClosed && (
            <Button variant="outline" size="sm" onClick={() => {
              if (window.confirm("Close this session? No more check-ins will be allowed.")) {
                closeSessionMutation.mutate(selectedSession.id);
              }
            }} className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <Lock className="h-4 w-4" /><span className="hidden sm:inline ml-2">Close Session</span>
            </Button>
          )}
          {canManage && (
            <Button onClick={() => { setForm({ title: "", session_type: "Sunday Service", session_date: "", notes: "", unit: "" }); setDialogOpen(true); }} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
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
              {filteredSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions found</p>
              ) : filteredSessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedSession?.id === s.id ? "bg-primary/10 border border-primary/20" : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground flex items-center gap-2">
                      <span className="truncate">{s.title || s.session_type}</span>
                      {s.status === "closed" && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.session_type} · {s.session_date}</p>
                    {(s.male_count > 0 || s.female_count > 0) && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        M: {s.male_count} · F: {s.female_count} · T: {s.total_count}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-xs shrink-0 ${s.status === "closed" ? "text-muted-foreground" : "text-chart-3"}`}>
                    {s.status === "closed" ? "Closed" : "Open"}
                  </Badge>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Check-ins</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {/* Demographics summary for selected session */}
                {selectedSession && (selectedSession.male_count > 0 || selectedSession.female_count > 0) && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-primary/5 rounded-lg p-2 text-center border border-primary/10">
                      <p className="text-lg font-bold text-primary">{selectedSession.male_count}</p>
                      <p className="text-[11px] text-muted-foreground">Male</p>
                    </div>
                    <div className="bg-accent/5 rounded-lg p-2 text-center border border-accent/10">
                      <p className="text-lg font-bold text-accent">{selectedSession.female_count}</p>
                      <p className="text-[11px] text-muted-foreground">Female</p>
                    </div>
                    <div className="bg-muted rounded-lg p-2 text-center border border-border">
                      <p className="text-lg font-bold text-foreground">{selectedSession.total_count}</p>
                      <p className="text-[11px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                )}
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

            {/* Session Report — only for unit leaders after session is closed */}
            {selectedSession && isClosed && (isAdmin || isUnitLeader) && (
              <Card className="border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><FileText className="h-4 w-4 text-accent" /> Session Report</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Male</Label>
                      <Input type="number" min="0" value={demoForm.male_count} onChange={e => setDemoForm(f => ({ ...f, male_count: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Female</Label>
                      <Input type="number" min="0" value={demoForm.female_count} onChange={e => setDemoForm(f => ({ ...f, female_count: e.target.value }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Total</Label>
                      <div className="h-9 flex items-center px-3 rounded-md border border-input bg-muted text-sm font-medium text-foreground">{demoTotal}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={updateDemographicsMutation.isPending}
                    onClick={() => updateDemographicsMutation.mutate({
                      sessionId: selectedSession.id,
                      male_count: parseInt(demoForm.male_count) || 0,
                      female_count: parseInt(demoForm.female_count) || 0,
                    })}
                  >
                    {updateDemographicsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Demographics
                  </Button>
                  <div className="pt-2 border-t">
                    <ReportAttachments relatedTable="attendance_sessions" relatedId={selectedSession.id} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
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
            {form.session_type === "Unit Meeting" && (
              <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. Choir, Ushering" /></div>
            )}
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={() => createSessionMutation.mutate(form)} disabled={createSessionMutation.isPending || !form.session_date} className="w-full bg-primary">
              {createSessionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
