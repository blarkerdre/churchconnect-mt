import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Plus, Trash2, Edit, Play, Square, RotateCcw, CalendarClock } from "lucide-react";

const emptyForm = {
  name: "",
  description: "",
  starts_on: "",
  ends_on: "",
  pass_mark_percentage: 50,
  auto_open_exams: true,
  allow_reregistration: true,
  auto_schedule: false,
  courses: [],
};

function statusMeta(s) {
  const v = (s?.status || "draft").toLowerCase();
  if (v === "active") return { label: "Open", variant: "default" };
  if (v === "closed") return { label: "Closed", variant: "secondary" };
  return { label: "Upcoming", variant: "outline" };
}

function fmt(d) {
  if (!d) return "—";
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

export default function SessionManager() {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const { user, isAdmin } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmClose, setConfirmClose] = useState(null);
  const [confirmStart, setConfirmStart] = useState(null);
  const [conflict, setConflict] = useState(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["exam-titles-for-sessions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_titles")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["exam-sessions-manage", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_sessions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["exam-session-courses", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_session_courses")
        .select("session_id, exam_title, sort_order")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["exam-session-counts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [regs, attempts, reports] = await Promise.all([
        supabase.from("course_registrations").select("session_id").eq("tenant_id", tenantId).not("session_id", "is", null),
        supabase.from("exam_attempts").select("session_id").eq("tenant_id", tenantId).not("session_id", "is", null),
        supabase.from("wofbi_course_reports").select("session_id").eq("tenant_id", tenantId).not("session_id", "is", null),
      ]);
      const out = {};
      const bump = (id, key) => {
        out[id] = out[id] || { regs: 0, attempts: 0, reports: 0 };
        out[id][key] += 1;
      };
      for (const r of regs.data || []) bump(r.session_id, "regs");
      for (const a of attempts.data || []) bump(a.session_id, "attempts");
      for (const r of reports.data || []) bump(r.session_id, "reports");
      return out;
    },
  });


  const coursesFor = useMemo(() => {
    const map = {};
    for (const l of links) {
      map[l.session_id] = map[l.session_id] || [];
      map[l.session_id].push(l.exam_title);
    }
    return map;
  }, [links]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({
      name: s.name || "",
      description: s.description || "",
      starts_on: s.starts_on || "",
      ends_on: s.ends_on || "",
      pass_mark_percentage: s.pass_mark_percentage ?? 50,
      auto_open_exams: !!s.auto_open_exams,
      allow_reregistration: !!s.allow_reregistration,
      auto_schedule: !!s.auto_schedule,
      courses: coursesFor[s.id] || [],
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant context");
      if (!form.name.trim()) throw new Error("Session name is required");
      if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) {
        throw new Error("End date cannot be before the start date");
      }
      const payload = {
        name: form.name.trim(),
        description: form.description?.trim() || null,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        pass_mark_percentage: Number(form.pass_mark_percentage) || 50,
        auto_open_exams: form.auto_open_exams,
        allow_reregistration: form.allow_reregistration,
        auto_schedule: form.auto_schedule,
        tenant_id: tenantId,
      };

      let sessionId = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from("exam_sessions")
          .update(payload)
          .eq("id", editing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("exam_sessions")
          .insert({ ...payload, status: "draft", created_by: user?.id || null })
          .select("id")
          .single();
        if (error) throw error;
        sessionId = data.id;
      }

      // Re-sync course links
      const { error: delErr } = await supabase
        .from("exam_session_courses")
        .delete()
        .eq("session_id", sessionId)
        .eq("tenant_id", tenantId);
      if (delErr) throw delErr;

      if (form.courses.length) {
        const rows = form.courses.map((name, i) => ({
          session_id: sessionId,
          exam_title: name,
          sort_order: i,
          tenant_id: tenantId,
        }));
        const { error: insErr } = await supabase.from("exam_session_courses").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Session updated" : "Session created" });
      setDialogOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["exam-sessions-manage", tenantId] });
      qc.invalidateQueries({ queryKey: ["exam-session-courses", tenantId] });
      qc.invalidateQueries({ queryKey: ["exam-sessions-report"] });
    },
    onError: (e) => toast({ title: "Could not save session", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ session, status }) => {
      const patch = { status };
      if (status === "active") patch.started_at = session.started_at || new Date().toISOString();
      if (status === "closed") patch.ended_at = new Date().toISOString();
      const { error } = await supabase
        .from("exam_sessions")
        .update(patch)
        .eq("id", session.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast({
        title: vars.status === "active" ? "Session started" : vars.status === "closed" ? "Session closed" : "Session updated",
      });
      qc.invalidateQueries({ queryKey: ["exam-sessions-manage", tenantId] });
      qc.invalidateQueries({ queryKey: ["exam-sessions-report"] });
      qc.invalidateQueries({ queryKey: ["exam-titles", tenantId] });
      qc.invalidateQueries({ queryKey: ["exam-session-course-control", tenantId] });
    },
    onError: (e) => toast({ title: "Could not update session", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error: linkErr } = await supabase
        .from("exam_session_courses").delete().eq("session_id", id).eq("tenant_id", tenantId);
      if (linkErr) throw linkErr;
      const { error } = await supabase.from("exam_sessions").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Session deleted" });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["exam-sessions-manage", tenantId] });
      qc.invalidateQueries({ queryKey: ["exam-session-courses", tenantId] });
    },
    onError: (e) =>
      toast({
        title: "Could not delete session",
        description:
          e?.code === "23503" || /foreign key/i.test(e?.message || "")
            ? "This session still has exam attempts linked to it, so it cannot be deleted. Close it instead."
            : e?.message || "Unknown error",
        variant: "destructive",
      }),

  });

  const handleStart = (session) => {
    const mine = coursesFor[session.id] || [];
    const clash = sessions.find(
      (s) => s.id !== session.id && (s.status || "").toLowerCase() === "active" &&
        (coursesFor[s.id] || []).some((c) => mine.includes(c))
    );
    if (clash) {
      setConflict({ session, clash });
      return;
    }
    setConfirmStart(session);
  };


  const toggleCourse = (name) => {
    setForm((f) => ({
      ...f,
      courses: f.courses.includes(name) ? f.courses.filter((c) => c !== name) : [...f.courses, name],
    }));
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Only administrators can manage Bible School sessions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarClock className="h-5 w-5" /> Sessions / editions
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              A session is one intake of a course. Starting it opens applications and registration for the attached courses (and exams, if “Open exams automatically” is on); closing it shuts them again.
            </p>

          </div>
          <Button size="sm" onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sessions yet. Create one to start an intake.
            </p>
          ) : (
            sessions.map((s) => {
              const meta = statusMeta(s);
              const c = counts[s.id] || { regs: 0, attempts: 0 };
              const linked = coursesFor[s.id] || [];
              const status = (s.status || "draft").toLowerCase();
              return (
                <div key={s.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words">{s.name}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {s.auto_schedule && <Badge variant="outline" className="text-[10px]">Auto schedule</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(s.starts_on)} – {fmt(s.ends_on)} · {c.regs} registration{c.regs === 1 ? "" : "s"} · {c.attempts} exam attempt{c.attempts === 1 ? "" : "s"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {linked.length ? linked.map((n) => (
                      <Badge key={n} variant="secondary" className="text-[10px] font-normal">{n}</Badge>
                    )) : <span className="text-xs text-muted-foreground">No courses attached</span>}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {status !== "active" && (
                      <Button size="sm" variant={status === "closed" ? "outline" : "default"} onClick={() => handleStart(s)}>
                        {status === "closed" ? <RotateCcw className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                        {status === "closed" ? "Reopen" : "Start session"}
                      </Button>
                    )}
                    {status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => setConfirmClose(s)}>
                        <Square className="h-4 w-4 mr-1" /> Close session
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                      <Edit className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <TenantDialogHeader title={editing ? "Edit session" : "New session"} />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name / edition *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Q1 2026 Edition"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <Input type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Pass mark (%)</Label>
              <Input
                type="number" min={0} max={100}
                value={form.pass_mark_percentage}
                onChange={(e) => setForm({ ...form, pass_mark_percentage: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Courses in this session</Label>
              <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                {courses.length === 0 && <p className="p-3 text-xs text-muted-foreground">No courses yet.</p>}
                {courses.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer">
                    <Checkbox checked={form.courses.includes(c.name)} onCheckedChange={() => toggleCourse(c.name)} />
                    <span className="break-words">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Open exams automatically</Label>
                  <p className="text-xs text-muted-foreground">Exams unlock for students in this session.</p>
                </div>
                <Switch checked={form.auto_open_exams} onCheckedChange={(v) => setForm({ ...form, auto_open_exams: v })} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Allow re-registration</Label>
                  <p className="text-xs text-muted-foreground">Past students may enrol again in this session.</p>
                </div>
                <Switch checked={form.allow_reregistration} onCheckedChange={(v) => setForm({ ...form, allow_reregistration: v })} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Auto start &amp; close on dates</Label>
                  <p className="text-xs text-muted-foreground">Opens on the start date and closes after the end date.</p>
                </div>
                <Switch checked={form.auto_schedule} onCheckedChange={(v) => setForm({ ...form, auto_schedule: v })} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save changes" : "Create session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmStart} onOpenChange={(o) => !o && setConfirmStart(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start “{confirmStart?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {(coursesFor[confirmStart?.id] || []).length
                ? <>Applications and registration will be opened for: {(coursesFor[confirmStart?.id] || []).join(", ")}.{confirmStart?.auto_open_exams ? " Exams will be opened for these courses too." : ""} New registrations will be linked to this session.</>
                : <>No courses are attached yet, so nothing will be opened. Attach courses first if you want this session to control registration.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                statusMutation.mutate({ session: confirmStart, status: "active" });
                setConfirmStart(null);
              }}
            >
              Start session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmClose} onOpenChange={(o) => !o && setConfirmClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {(coursesFor[confirmClose?.id] || []).length
                ? <>Applications and registration will be closed for: {(coursesFor[confirmClose?.id] || []).join(", ")}.{confirmClose?.auto_open_exams ? " Exams will be closed for these courses too." : ""} </>
                : null}
              New registrations will no longer be linked to “{confirmClose?.name}”. You can reopen it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                statusMutation.mutate({ session: confirmClose, status: "closed" });
                setConfirmClose(null);
              }}
            >
              Close session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Another session is already open</AlertDialogTitle>
            <AlertDialogDescription>
              “{conflict?.clash?.name}” is open for the same course. Close it and start “{conflict?.session?.name}” instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const { session, clash } = conflict;
                setConflict(null);
                await statusMutation.mutateAsync({ session: clash, status: "closed" });
                statusMutation.mutate({ session, status: "active" });
              }}
            >
              Close &amp; start
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” will be removed. Registrations and reports linked to it keep their data but lose the edition label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteMutation.mutate(deleteTarget.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
