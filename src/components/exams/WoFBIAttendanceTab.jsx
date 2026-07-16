import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, QrCode, Trash2, Download, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import WoFBIAttendanceQRDialog from "./WoFBIAttendanceQRDialog";

function pct(num, den) {
  if (!den) return "0%";
  return `${Math.round((num / den) * 100)}%`;
}

function fmtDuration(mins) {
  if (mins == null || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function WoFBIAttendanceTab() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [rosterSession, setRosterSession] = useState(null);

  const [form, setForm] = useState({
    title: "",
    session_date: new Date().toISOString().slice(0, 10),
    late_after: "",
    subject_id: "",
    notes: "",
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["wofbi-att-courses", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("exam_titles").select("id, name, course_code").order("name")
      );
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select first course
  React.useEffect(() => {
    if (!selectedCourseId && courses.length) setSelectedCourseId(courses[0].id);
  }, [courses, selectedCourseId]);

  const { data: subjects = [] } = useQuery({
    queryKey: ["wofbi-att-subjects", tenantId, selectedCourseId],
    enabled: !!tenantId && !!selectedCourseId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("exam_subjects").select("id, name").eq("course_id", selectedCourseId).order("name")
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["wofbi-att-sessions", tenantId, selectedCourseId],
    enabled: !!tenantId && !!selectedCourseId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("wofbi_attendance_sessions")
          .select("*")
          .eq("course_id", selectedCourseId)
          .order("session_date", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  // Counts of records per session for the sessions list
  const { data: recordsBySession = {} } = useQuery({
    queryKey: ["wofbi-att-record-counts", tenantId, selectedCourseId, sessions.map((s) => s.id).join(",")],
    enabled: !!tenantId && sessions.length > 0,
    queryFn: async () => {
      const ids = sessions.map((s) => s.id);
      const { data, error } = await supabase
        .from("wofbi_attendance_records")
        .select("session_id, status")
        .in("session_id", ids);
      if (error) throw error;
      const map = {};
      for (const r of data || []) {
        if (!map[r.session_id]) map[r.session_id] = { present: 0, late: 0 };
        if (r.status === "late") map[r.session_id].late += 1;
        else map[r.session_id].present += 1;
      }
      return map;
    },
  });

  // Roster: approved/enrolled registrants of the course
  const { data: roster = [] } = useQuery({
    queryKey: ["wofbi-att-roster", tenantId, selectedCourseId],
    enabled: !!tenantId && !!selectedCourseId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("course_registrations")
          .select("id, member_id, student_number, status, members:member_id(id, first_name, last_name)")
          .eq("course_id", selectedCourseId)
          .in("status", ["approved", "enrolled", "active", "completed"])
      );
      if (error) throw error;
      return data || [];
    },
  });

  // All records across sessions for the % report
  const { data: allRecords = [] } = useQuery({
    queryKey: ["wofbi-att-all-records", tenantId, selectedCourseId, sessions.map((s) => s.id).join(",")],
    enabled: !!tenantId && sessions.length > 0,
    queryFn: async () => {
      const ids = sessions.map((s) => s.id);
      const { data, error } = await supabase
        .from("wofbi_attendance_records")
        .select("id, session_id, registration_id, member_id, status, checked_in_at, checked_out_at, duration_minutes")
        .in("session_id", ids);
      if (error) throw error;
      return data || [];
    },
  });

  // Records for currently open roster panel
  const { data: rosterRecords = [] } = useQuery({
    queryKey: ["wofbi-att-roster-records", rosterSession?.id],
    enabled: !!rosterSession?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wofbi_attendance_records")
        .select("*")
        .eq("session_id", rosterSession.id);
      if (error) throw error;
      return data || [];
    },
  });

  const createSession = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from("wofbi_attendance_sessions").insert(
        withTenant({
          course_id: selectedCourseId,
          subject_id: payload.subject_id || null,
          title: payload.title,
          session_date: payload.session_date,
          late_after: payload.late_after || null,
          notes: payload.notes || null,
          status: "open",
          created_by: user?.id || null,
        })
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Attendance session created" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] });
      setNewOpen(false);
      setForm({ title: "", session_date: new Date().toISOString().slice(0, 10), late_after: "", subject_id: "", notes: "" });
    },
    onError: (e) => toast({ title: "Failed to create session", description: e.message, variant: "destructive" }),
  });

  const deleteSession = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("wofbi_attendance_sessions").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Session deleted" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] });
    },
    onError: (e) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const reopenSession = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("wofbi_attendance_sessions")
        .update({ status: "open", qr_token: crypto.randomUUID() })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Session reopened" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] });
    },
    onError: (e) => toast({ title: "Reopen failed", description: e.message, variant: "destructive" }),
  });

  const markStatus = useMutation({
    mutationFn: async ({ registration, status, action }) => {
      if (!rosterSession) throw new Error("No session");
      const existing = rosterRecords.find((r) => r.registration_id === registration.id);

      // Time-out actions
      if (action === "set_time_out") {
        if (!existing) throw new Error("Set a time-in first");
        const now = new Date();
        const inAt = existing.checked_in_at ? new Date(existing.checked_in_at) : now;
        const duration = Math.max(0, Math.round((now - inAt) / 60000));
        const { error } = await supabase
          .from("wofbi_attendance_records")
          .update({ checked_out_at: now.toISOString(), duration_minutes: duration })
          .eq("id", existing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        return;
      }
      if (action === "clear_time_out") {
        if (!existing) return;
        const { error } = await supabase
          .from("wofbi_attendance_records")
          .update({ checked_out_at: null, duration_minutes: null })
          .eq("id", existing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        return;
      }

      if (status === "absent") {
        if (existing) {
          const { error } = await supabase
            .from("wofbi_attendance_records")
            .delete()
            .eq("id", existing.id)
            .eq("tenant_id", tenantId);
          if (error) throw error;
        }
        return;
      }
      if (existing) {
        const { error } = await supabase
          .from("wofbi_attendance_records")
          .update({ status, checked_in_at: existing.checked_in_at || new Date().toISOString() })
          .eq("id", existing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wofbi_attendance_records").insert(
          withTenant({
            session_id: rosterSession.id,
            registration_id: registration.id,
            member_id: registration.member_id,
            status,
            checked_in_at: new Date().toISOString(),
            source: "manual",
          })
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wofbi-att-roster-records"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-record-counts"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-all-records"] });
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  // Attendance % per student
  const perStudent = useMemo(() => {
    const totalSessions = sessions.length;
    return roster.map((r) => {
      const recs = allRecords.filter((x) => x.registration_id === r.id);
      const present = recs.filter((x) => x.status === "present").length;
      const late = recs.filter((x) => x.status === "late").length;
      const attended = present + late;
      const absent = Math.max(0, totalSessions - attended);
      const totalMinutes = recs.reduce((sum, x) => sum + (x.duration_minutes || 0), 0);
      const missingCheckouts = recs.filter((x) => x.checked_in_at && !x.checked_out_at).length;
      return {
        registration: r,
        present,
        late,
        absent,
        totalSessions,
        totalMinutes,
        missingCheckouts,
        percent: totalSessions ? Math.round((attended / totalSessions) * 100) : 0,
      };
    });
  }, [roster, allRecords, sessions.length]);

  const exportCsv = () => {
    const header = ["Student number", "Name", "Present", "Late", "Absent", "Total sessions", "Attendance %", "Total hours", "Missing check-outs"];
    const rows = perStudent.map((s) => [
      s.registration.student_number || "",
      `${s.registration.members?.first_name || ""} ${s.registration.members?.last_name || ""}`.trim(),
      s.present,
      s.late,
      s.absent,
      s.totalSessions,
      s.percent,
      (s.totalMinutes / 60).toFixed(2),
      s.missingCheckouts,
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const course = courses.find((c) => c.id === selectedCourseId);
    a.download = `${(course?.name || "course").replace(/\s+/g, "-")}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view Bible School attendance.</p>;
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-lg">Bible School Attendance</CardTitle>
            <p className="text-xs text-muted-foreground">Run on-premise QR check-in per course.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setNewOpen(true)} disabled={!selectedCourseId} className="gap-2">
              <Plus className="h-4 w-4" /> New session
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No attendance sessions yet for this course.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const c = recordsBySession[s.id] || { present: 0, late: 0 };
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">{s.session_date}</TableCell>
                      <TableCell className="font-medium">{s.title}</TableCell>
                      <TableCell>{c.present}</TableCell>
                      <TableCell>{c.late}</TableCell>
                      <TableCell>
                        {s.status === "open" ? (
                          <Badge className="bg-green-100 text-green-800">Open</Badge>
                        ) : (
                          <Badge variant="secondary">Closed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => setQrSession(s)} className="gap-1">
                          <QrCode className="h-3.5 w-3.5" /> QR
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRosterSession(s)}>
                          Roster
                        </Button>
                        {s.status === "closed" && (
                          <Button size="sm" variant="ghost" onClick={() => reopenSession.mutate(s.id)}>
                            Reopen
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Delete this attendance session and all its check-ins?")) deleteSession.mutate(s.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-lg">Attendance report</CardTitle>
            <p className="text-xs text-muted-foreground">
              {selectedCourse?.name || "Course"} · {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!perStudent.length} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {perStudent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No registered students on this course yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Total hours</TableHead>
                  <TableHead>Missing out</TableHead>
                  <TableHead>Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perStudent.map((s) => (
                  <TableRow key={s.registration.id}>
                    <TableCell>{s.registration.student_number || "—"}</TableCell>
                    <TableCell className="font-medium">
                      {`${s.registration.members?.first_name || ""} ${s.registration.members?.last_name || ""}`.trim() || "Unknown"}
                    </TableCell>
                    <TableCell>{s.present}</TableCell>
                    <TableCell>{s.late}</TableCell>
                    <TableCell>{s.absent}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDuration(s.totalMinutes)}</TableCell>
                    <TableCell>
                      {s.missingCheckouts > 0 ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">{s.missingCheckouts}</Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={s.percent >= 75 ? "bg-green-100 text-green-800" : s.percent >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                        {s.percent}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New session dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <TenantDialogHeader>New Attendance Session</TenantDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Week 3 - Doctrine" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Late after (optional)</Label>
                <Input type="time" value={form.late_after} onChange={(e) => setForm({ ...form, late_after: e.target.value })} />
              </div>
            </div>
            {subjects.length > 0 && (
              <div className="space-y-1.5">
                <Label>Subject (optional)</Label>
                <Select value={form.subject_id || "none"} onValueChange={(v) => setForm({ ...form, subject_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="No subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No subject</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createSession.mutate(form)}
              disabled={!form.title || !form.session_date || createSession.isPending}
            >
              {createSession.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR dialog */}
      <WoFBIAttendanceQRDialog
        open={!!qrSession}
        onOpenChange={(v) => !v && setQrSession(null)}
        session={qrSession}
        onClosed={() => qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] })}
      />

      {/* Roster override dialog */}
      <Dialog open={!!rosterSession} onOpenChange={(v) => !v && setRosterSession(null)}>
        <DialogContent className="max-w-3xl">
          <TenantDialogHeader>Roster · {rosterSession?.title}</TenantDialogHeader>
          <div className="max-h-[65vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time in</TableHead>
                  <TableHead>Time out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((r) => {
                  const rec = rosterRecords.find((x) => x.registration_id === r.id);
                  const status = rec?.status || "absent";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">
                          {`${r.members?.first_name || ""} ${r.members?.last_name || ""}`.trim() || "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.student_number || "—"}</div>
                      </TableCell>
                      <TableCell>
                        {status === "present" && <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" /> Present</Badge>}
                        {status === "late" && <Badge className="bg-amber-100 text-amber-800 gap-1"><Clock className="h-3 w-3" /> Late</Badge>}
                        {status === "absent" && <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Absent</Badge>}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(rec?.checked_in_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(rec?.checked_out_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDuration(rec?.duration_minutes)}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant={status === "present" ? "default" : "outline"} onClick={() => markStatus.mutate({ registration: r, status: "present" })}>Present</Button>
                        <Button size="sm" variant={status === "late" ? "default" : "outline"} onClick={() => markStatus.mutate({ registration: r, status: "late" })}>Late</Button>
                        <Button size="sm" variant={status === "absent" ? "default" : "outline"} onClick={() => markStatus.mutate({ registration: r, status: "absent" })}>Absent</Button>
                        {rec && !rec.checked_out_at && (
                          <Button size="sm" variant="outline" onClick={() => markStatus.mutate({ registration: r, action: "set_time_out" })}>Time-out</Button>
                        )}
                        {rec?.checked_out_at && (
                          <Button size="sm" variant="ghost" onClick={() => markStatus.mutate({ registration: r, action: "clear_time_out" })}>Clear out</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {roster.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No registered students.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
