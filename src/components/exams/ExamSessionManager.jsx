import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Loader2, Plus, Play, Square, Eye, Trash2, Edit, ClipboardList, Trophy, ChevronDown, ChevronUp } from "lucide-react";

const STATUS_COLORS = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-chart-3/10 text-chart-3",
  closed: "bg-primary/10 text-primary",
};

export default function ExamSessionManager() {
  const { user } = useAuth();
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", pass_mark_percentage: 50, courses: [] });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["exam-sessions", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("exam_sessions").select("*").order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data;
    },
  });

  const { data: examTitles = [] } = useQuery({
    queryKey: ["exam-titles", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("exam_titles").select("*").eq("is_active", true).order("name"));
      if (error) throw error;
      return data;
    },
  });

  const { data: sessionCourses = [] } = useQuery({
    queryKey: ["exam-session-courses", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("exam_session_courses").select("*").order("sort_order"));
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ sessionData, courses }) => {
      let sessionId;
      if (editingSession) {
        const { error } = await supabase.from("exam_sessions").update(sessionData).eq("id", editingSession.id);
        if (error) throw error;
        sessionId = editingSession.id;
        // Delete existing courses and re-insert
        await supabase.from("exam_session_courses").delete().eq("session_id", sessionId);
      } else {
        const { data, error } = await supabase.from("exam_sessions").insert(withTenant(sessionData)).select("id").single();
        if (error) throw error;
        sessionId = data.id;
      }
      if (courses.length > 0) {
        const rows = courses.map((title, idx) => withTenant({ session_id: sessionId, exam_title: title, sort_order: idx }));
        const { error } = await supabase.from("exam_session_courses").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-sessions", tenantId] });
      qc.invalidateQueries({ queryKey: ["exam-session-courses", tenantId] });
      toast({ title: editingSession ? "Session updated" : "Session created" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("exam_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-sessions"] });
      toast({ title: "Session deleted" });
      setDeleteTarget(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const updates = { status, updated_at: new Date().toISOString() };
      if (status === "active") updates.started_at = new Date().toISOString();
      if (status === "closed") updates.ended_at = new Date().toISOString();
      const { error } = await supabase.from("exam_sessions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-sessions"] });
      toast({ title: "Session status updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSession(null);
    setForm({ name: "", description: "", pass_mark_percentage: 50, courses: [] });
  };

  const openEdit = (session) => {
    const courses = sessionCourses.filter(c => c.session_id === session.id).map(c => c.exam_title);
    setEditingSession(session);
    setForm({ name: session.name, description: session.description || "", pass_mark_percentage: session.pass_mark_percentage, courses });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: "Session name is required", variant: "destructive" }); return; }
    if (form.courses.length === 0) { toast({ title: "Select at least one course exam", variant: "destructive" }); return; }
    saveMutation.mutate({
      sessionData: {
        name: form.name.trim(),
        description: form.description.trim() || null,
        pass_mark_percentage: Number(form.pass_mark_percentage) || 50,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      },
      courses: form.courses,
    });
  };

  const toggleCourse = (title) => {
    setForm(f => ({
      ...f,
      courses: f.courses.includes(title) ? f.courses.filter(c => c !== title) : [...f.courses, title],
    }));
  };

  const hasActiveSession = sessions.some(s => s.status === "active");

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Exam Sessions
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditingSession(null); setForm({ name: "", description: "", pass_mark_percentage: 50, courses: [] }); setDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5" /> New Session
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No exam sessions yet. Create one to group course exams together.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map(s => {
                const courses = sessionCourses.filter(c => c.session_id === s.id);
                return (
                  <div key={s.id} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                          <Badge className={`${STATUS_COLORS[s.status]} border-0 text-[10px]`}>{s.status}</Badge>
                          <Badge variant="outline" className="text-[10px]">Pass: {s.pass_mark_percentage}%</Badge>
                        </div>
                        {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {courses.map(c => (
                            <Badge key={c.id} variant="secondary" className="text-[10px]">{c.exam_title}</Badge>
                          ))}
                          {courses.length === 0 && <span className="text-xs text-muted-foreground">No courses assigned</span>}
                        </div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground mt-2">
                          {s.started_at && <span>Started: {new Date(s.started_at).toLocaleDateString()}</span>}
                          {s.ended_at && <span>Ended: {new Date(s.ended_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.status === "draft" && (
                          <Button
                            variant="outline" size="sm" className="gap-1 text-chart-3 border-chart-3/30 hover:bg-chart-3/10 h-7 text-xs"
                            disabled={hasActiveSession || statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: s.id, status: "active" })}
                          >
                            <Play className="h-3 w-3" /> Start
                          </Button>
                        )}
                        {s.status === "active" && (
                          <Button
                            variant="outline" size="sm" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 h-7 text-xs"
                            disabled={statusMutation.isPending}
                            onClick={() => statusMutation.mutate({ id: s.id, status: "closed" })}
                          >
                            <Square className="h-3 w-3" /> Stop
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewingSession(viewingSession?.id === s.id ? null : s)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {s.status === "draft" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(s)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aggregate Results View */}
      {viewingSession && (
        <SessionAggregateResults session={viewingSession} sessionCourses={sessionCourses.filter(c => c.session_id === viewingSession.id)} />
      )}

      {/* Create/Edit Session Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSession ? "Edit Session" : "Create Exam Session"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Session Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. March 2026 BFC Cohort" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Aggregate Pass Mark (%)</Label>
              <Input type="number" min="0" max="100" value={form.pass_mark_percentage} onChange={e => setForm(f => ({ ...f, pass_mark_percentage: e.target.value }))} className="w-28" />
            </div>
            <div className="space-y-2">
              <Label>Course Exams *</Label>
              <p className="text-xs text-muted-foreground">Select which exams members must take in this session.</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {examTitles.map(t => (
                  <label key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={form.courses.includes(t.name)} onCheckedChange={() => toggleCourse(t.name)} />
                    <span className="text-sm">{t.name}</span>
                    {t.description && <span className="text-xs text-muted-foreground">— {t.description}</span>}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{form.courses.length} course(s) selected</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingSession ? "Update" : "Create"} Session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>Delete "{deleteTarget?.name}"? This will also remove all linked course assignments.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SessionAggregateResults({ session, sessionCourses }) {
  const courseNames = sessionCourses.map(c => c.exam_title);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ["session-attempts", session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, members(first_name, last_name)")
        .eq("session_id", session.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!session.id,
  });

  // Group by member
  const memberMap = {};
  attempts.forEach(a => {
    if (!memberMap[a.member_id]) {
      memberMap[a.member_id] = {
        name: `${a.members?.first_name || ""} ${a.members?.last_name || ""}`.trim(),
        courses: {},
        totalScore: 0,
        totalPoints: 0,
      };
    }
    const m = memberMap[a.member_id];
    // Use best attempt per course
    if (!m.courses[a.training_type] || (a.score / a.total_points) > (m.courses[a.training_type].score / m.courses[a.training_type].total_points)) {
      // Remove old from totals
      if (m.courses[a.training_type]) {
        m.totalScore -= m.courses[a.training_type].score;
        m.totalPoints -= m.courses[a.training_type].total_points;
      }
      m.courses[a.training_type] = { score: a.score, total_points: a.total_points, passed: a.passed };
      m.totalScore += a.score;
      m.totalPoints += a.total_points;
    }
  });

  const members = Object.entries(memberMap).map(([id, m]) => ({
    id,
    ...m,
    percentage: m.totalPoints > 0 ? (m.totalScore / m.totalPoints) * 100 : 0,
    examsTaken: Object.keys(m.courses).length,
    sessionPassed: m.totalPoints > 0 && ((m.totalScore / m.totalPoints) * 100) >= session.pass_mark_percentage,
  }));

  const totalParticipants = members.length;
  const totalPassed = members.filter(m => m.sessionPassed && m.examsTaken === courseNames.length).length;
  const avgScore = members.length > 0 ? members.reduce((s, m) => s + m.percentage, 0) / members.length : 0;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> {session.name} — Aggregate Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No exam attempts in this session yet.</p>
        ) : (
          <>
            {/* Summary */}
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <div className="px-3 py-2 rounded-lg bg-muted">
                <span className="text-muted-foreground">Participants:</span> <strong>{totalParticipants}</strong>
              </div>
              <div className="px-3 py-2 rounded-lg bg-muted">
                <span className="text-muted-foreground">Fully Passed:</span> <strong>{totalPassed}</strong>
              </div>
              <div className="px-3 py-2 rounded-lg bg-muted">
                <span className="text-muted-foreground">Avg Score:</span> <strong>{Math.round(avgScore)}%</strong>
              </div>
              <div className="px-3 py-2 rounded-lg bg-muted">
                <span className="text-muted-foreground">Pass Rate:</span> <strong>{totalParticipants > 0 ? Math.round((totalPassed / totalParticipants) * 100) : 0}%</strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    {courseNames.map(c => <TableHead key={c} className="text-center text-xs">{c}</TableHead>)}
                    <TableHead className="text-center">Aggregate</TableHead>
                    <TableHead className="text-center">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm font-medium">{m.name}</TableCell>
                      {courseNames.map(c => {
                        const ca = m.courses[c];
                        return (
                          <TableCell key={c} className="text-center text-xs">
                            {ca ? (
                              <span className={ca.passed ? "text-chart-3" : "text-destructive"}>
                                {ca.score}/{ca.total_points}
                              </span>
                            ) : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center text-sm font-semibold">
                        {m.totalScore}/{m.totalPoints} ({Math.round(m.percentage)}%)
                      </TableCell>
                      <TableCell className="text-center">
                        {m.examsTaken < courseNames.length ? (
                          <Badge variant="secondary" className="text-[10px]">{m.examsTaken}/{courseNames.length}</Badge>
                        ) : (
                          <Badge variant={m.sessionPassed ? "default" : "destructive"} className="text-[10px]">
                            {m.sessionPassed ? "Passed" : "Failed"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
