import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Loader2, Plus, Trash2, Edit, Layers } from "lucide-react";

export default function SubjectManager({ course, onSelectSubject, selectedSubjectId }) {
  const qc = useQueryClient();
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", pass_mark_percentage: 50, time_limit_minutes: "", randomize_questions: false, useCustomGrades: false, grade_classifications: [] });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["exam-subjects", course.id, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("exam_subjects").select("*").eq("course_id", course.id).order("sort_order").order("created_at")
      );
      if (error) throw error;
      return data;
    },
    enabled: !!course.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        const { error } = await supabase.from("exam_subjects").update(payload).eq("id", editing.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exam_subjects").insert(withTenant({ ...payload, course_id: course.id, sort_order: subjects.length }));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-subjects", course.id] });
      qc.invalidateQueries({ queryKey: ["all-exam-subjects"] });
      toast({ title: editing ? "Subject updated" : "Subject added" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("exam_subjects").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-subjects", course.id] });
      qc.invalidateQueries({ queryKey: ["all-exam-subjects"] });
      toast({ title: "Subject deleted" });
      setDeleteTarget(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ name: "", description: "", pass_mark_percentage: 50, time_limit_minutes: "", randomize_questions: false, useCustomGrades: false, grade_classifications: [] });
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> {course.name} — Subjects
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditing(null); setForm({ name: "", description: "", pass_mark_percentage: 50, time_limit_minutes: "", randomize_questions: false, useCustomGrades: false, grade_classifications: [] }); setDialogOpen(true); }}>
              <Plus className="h-3.5 w-3.5" /> Add Subject
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No subjects yet. Add subjects to this course.</p>
          ) : (
            <div className="space-y-2">
              {subjects.map((s, idx) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSubjectId === s.id
                      ? "bg-primary/5 border-primary/30"
                      : "bg-card border-border hover:bg-muted/50"
                  }`}
                  onClick={() => onSelectSubject(s)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono w-5">{idx + 1}.</span>
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    {s.description && <span className="text-xs text-muted-foreground hidden sm:inline">— {s.description}</span>}
                    <Badge variant="outline" className="text-[9px] h-4">Pass: {s.pass_mark_percentage}%</Badge>
                    {s.time_limit_minutes && <Badge variant="outline" className="text-[9px] h-4">⏱ {s.time_limit_minutes}min</Badge>}
                    {s.randomize_questions && <Badge variant="outline" className="text-[9px] h-4">🔀 Random</Badge>}
                    {!s.is_active && <Badge variant="secondary" className="text-[9px] h-4">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditing(s); setForm({ name: s.name, description: s.description || "", pass_mark_percentage: s.pass_mark_percentage ?? 50, time_limit_minutes: s.time_limit_minutes ?? "", randomize_questions: s.randomize_questions ?? false, useCustomGrades: !!(s.grade_classifications && s.grade_classifications.length > 0), grade_classifications: s.grade_classifications || [] }); setDialogOpen(true); }}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-sm">
          <TenantDialogHeader>{editing ? "Edit Subject" : "Add Subject"}</TenantDialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) { toast({ title: "Subject name is required", variant: "destructive" }); return; }
            saveMutation.mutate({
              name: form.name.trim(),
              description: form.description.trim() || null,
              pass_mark_percentage: Number(form.pass_mark_percentage) || 50,
              time_limit_minutes: form.time_limit_minutes ? Number(form.time_limit_minutes) : null,
              randomize_questions: !!form.randomize_questions,
              grade_classifications: form.useCustomGrades && form.grade_classifications.length > 0 ? form.grade_classifications : null,
            });
          }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subject Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Church History" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Pass Mark (%)</Label>
              <Input type="number" min="0" max="100" value={form.pass_mark_percentage} onChange={e => setForm(f => ({ ...f, pass_mark_percentage: e.target.value }))} className="w-28" />
            </div>
            <div className="space-y-1.5">
              <Label>Time Limit (minutes)</Label>
              <Input type="number" min="1" value={form.time_limit_minutes} onChange={e => setForm(f => ({ ...f, time_limit_minutes: e.target.value }))} className="w-28" placeholder="No limit" />
              <p className="text-xs text-muted-foreground">Leave empty for no time limit</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <Label htmlFor="randomize" className="text-sm font-medium">Randomize Questions</Label>
              <Switch id="randomize" checked={!!form.randomize_questions} onCheckedChange={v => setForm(f => ({ ...f, randomize_questions: v }))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                <Label htmlFor="customGrades" className="text-sm font-medium">Custom Grade Bands</Label>
                <Switch id="customGrades" checked={!!form.useCustomGrades} onCheckedChange={v => setForm(f => ({ ...f, useCustomGrades: v, grade_classifications: v && f.grade_classifications.length === 0 ? [{ label: "Distinction", min_percentage: 75 }, { label: "Merit", min_percentage: 65 }, { label: "Pass", min_percentage: 50 }] : f.grade_classifications }))} />
              </div>
              {form.useCustomGrades ? (
                <div className="space-y-2 pl-1">
                  {form.grade_classifications.map((gc, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={gc.label}
                        onChange={e => {
                          const updated = [...form.grade_classifications];
                          updated[idx] = { ...updated[idx], label: e.target.value };
                          setForm(f => ({ ...f, grade_classifications: updated }));
                        }}
                        placeholder="Label"
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={gc.min_percentage}
                        onChange={e => {
                          const updated = [...form.grade_classifications];
                          updated[idx] = { ...updated[idx], min_percentage: Number(e.target.value) };
                          setForm(f => ({ ...f, grade_classifications: updated }));
                        }}
                        className="w-20"
                        placeholder="%"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setForm(f => ({ ...f, grade_classifications: f.grade_classifications.filter((_, i) => i !== idx) }))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setForm(f => ({ ...f, grade_classifications: [...f.grade_classifications, { label: "", min_percentage: 0 }] }))}>
                    <Plus className="h-3 w-3" /> Add Band
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pl-1">Inherits grade bands from course</p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editing ? "Update" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subject</AlertDialogTitle>
            <AlertDialogDescription>Delete "{deleteTarget?.name}"? This will also remove all linked questions.</AlertDialogDescription>
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
