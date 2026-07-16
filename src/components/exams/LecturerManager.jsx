import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DangerConfirmDialog from "@/components/exams/DangerConfirmDialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, Edit, Trash2, GraduationCap, Eye, Star } from "lucide-react";
import { logAudit } from "@/lib/audit";
import { OPTION_LABELS } from "@/lib/lecturer-feedback-options";

const emptyForm = { name: "", level: "", active: true };

export default function LecturerManager() {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const { currentTenant, refreshTenantContext } = useTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [feedbackLecturer, setFeedbackLecturer] = useState(null);

  const ratingEnabled = !!currentTenant?.settings?.wofbi_lecturer_rating_enabled;
  const qcEnabled = !!currentTenant?.settings?.wofbi_qc_enabled;

  const { data: lecturers = [], isLoading } = useQuery({
    queryKey: ["lecturers", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecturers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const toggleFeature = useMutation({
    mutationFn: async (enabled) => {
      const newSettings = { ...(currentTenant?.settings || {}), wofbi_lecturer_rating_enabled: enabled };
      const { error } = await supabase.from("tenants").update({ settings: newSettings }).eq("id", tenantId);
      if (error) throw error;
      await logAudit("wofbi_rating_toggle", "tenants", tenantId, { enabled }, tenantId);
      await refreshTenantContext?.();
    },
    onSuccess: () => toast({ title: "Setting saved" }),
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name is required");
      if (editing) {
        const { error } = await supabase
          .from("lecturers")
          .update({ name: form.name.trim(), level: form.level.trim() || null, active: form.active })
          .eq("id", editing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        await logAudit("lecturer_update", "lecturers", editing.id, { name: form.name }, tenantId);
      } else {
        const { data, error } = await supabase
          .from("lecturers")
          .insert({ tenant_id: tenantId, name: form.name.trim(), level: form.level.trim() || null, active: form.active })
          .select()
          .single();
        if (error) throw error;
        await logAudit("lecturer_create", "lecturers", data?.id, { name: form.name }, tenantId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecturers", tenantId] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast({ title: editing ? "Lecturer updated" : "Lecturer added" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("lecturers").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
      await logAudit("lecturer_delete", "lecturers", id, null, tenantId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecturers", tenantId] });
      setDeleteTarget(null);
      toast({ title: "Lecturer removed" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" /> Lecturer Feedback
        </CardTitle>
        <CardDescription>
          Manage lecturers and control whether students can submit "Rate the Lecturer" feedback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border rounded-lg p-3">
          <div className="pr-3">
            <p className="text-sm font-medium">Enable lecturer rating for students</p>
            <p className="text-xs text-muted-foreground">
              When on, Bible School students see a "Rate a Lecturer" button.
            </p>
          </div>
          <Switch
            checked={ratingEnabled}
            onCheckedChange={(v) => toggleFeature.mutate(v)}
            disabled={toggleFeature.isPending}
          />
        </div>

        {ratingEnabled && !isLoading && lecturers.filter((l) => l.active).length === 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-200">
            Rating is enabled, but there are no active lecturers yet. Add an active lecturer so students can submit ratings.
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Lecturers</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditing(null); setForm(emptyForm); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Lecturer
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : lecturers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No lecturers added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lecturers.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.level || "—"}</TableCell>
                    <TableCell>
                      {l.active ? (
                        <Badge variant="outline" className="text-[10px] border-chart-3/40 text-chart-3">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="View feedback" onClick={() => setFeedbackLecturer(l)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => {
                          setEditing(l);
                          setForm({ name: l.name, level: l.level || "", active: l.active });
                          setDialogOpen(true);
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete" onClick={() => setDeleteTarget(l)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Lecturer" : "Add Lecturer"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="lect-name">Name *</Label>
                <Input id="lect-name" value={form.name} maxLength={150} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="lect-level">Level (optional)</Label>
                <Input id="lect-level" placeholder="e.g. BFC / BCC / LCC / LDC" value={form.level} maxLength={100} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="lect-active">Active</Label>
                <Switch id="lect-active" checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DangerConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
          title="Delete Lecturer"
          entityName={deleteTarget?.name || ""}
          impacts={["The lecturer will be removed from the rating list", "All student feedback for this lecturer will be permanently deleted"]}
          confirmLabel="Delete lecturer"
          onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
          isPending={deleteMutation.isPending}
        />

        <LecturerFeedbackDialog
          lecturer={feedbackLecturer}
          onClose={() => setFeedbackLecturer(null)}
          tenantId={tenantId}
        />
      </CardContent>
    </Card>
  );
}

function LecturerFeedbackDialog({ lecturer, onClose, tenantId }) {
  const [subjectFilter, setSubjectFilter] = useState("all");

  const { data: ratings = [], isLoading } = useQuery({
    queryKey: ["lecturer-ratings", lecturer?.id, tenantId],
    enabled: !!lecturer?.id && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecturer_ratings")
        .select("*, members(first_name, last_name), exam_subjects(name), exam_titles(name)")
        .eq("lecturer_id", lecturer.id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const subjectOptions = Array.from(
    new Map(
      ratings
        .filter((r) => r.subject_id)
        .map((r) => [r.subject_id, r.exam_subjects?.name || "—"])
    ).entries()
  );

  const filtered = subjectFilter === "all"
    ? ratings
    : ratings.filter((r) => r.subject_id === subjectFilter);

  const avg = filtered.length
    ? Math.round((filtered.reduce((s, r) => s + (r.overall_rating || 0), 0) / filtered.length) * 10) / 10
    : null;

  return (
    <Dialog open={!!lecturer} onOpenChange={(v) => { if (!v) { setSubjectFilter("all"); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Feedback for {lecturer?.name}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : ratings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No feedback submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {subjectOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs">Filter by subject</Label>
                <select
                  className="text-xs border rounded px-2 py-1 bg-background"
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="all">All subjects</option>
                  {subjectOptions.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline">{filtered.length} submission{filtered.length !== 1 ? "s" : ""}</Badge>
              {avg !== null && <Badge variant="default">Avg rating: {avg}/10</Badge>}
            </div>
            {filtered.map((r) => (
              <div key={r.id} className="border rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {r.members ? `${r.members.first_name} ${r.members.last_name}` : "Student"}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {r.exam_titles?.name && <Badge variant="outline">Course: {r.exam_titles.name}</Badge>}
                  {r.exam_subjects?.name && <Badge variant="outline">Subject: {r.exam_subjects.name}</Badge>}
                  {r.level && <Badge variant="outline">Level: {r.level}</Badge>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <FieldRow label="Session" val={OPTION_LABELS.session_description[r.session_description]} />
                  <FieldRow label="Delivery" val={OPTION_LABELS.delivery[r.delivery]} />
                  <FieldRow label="Time keeping" val={OPTION_LABELS.time_keeping[r.time_keeping]} />
                  <FieldRow label="Class atmosphere" val={OPTION_LABELS.class_atmosphere[r.class_atmosphere]} />
                  <FieldRow label="Test" val={OPTION_LABELS.test_quality[r.test_quality]} />
                  <FieldRow label="Have again" val={OPTION_LABELS.have_again[r.have_again]} />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="secondary" className="text-[10px]">Overall: {r.overall_rating}/10</Badge>
                </div>
                {r.comments && <p className="text-xs italic text-muted-foreground pt-1">"{r.comments}"</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ label, val }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span>{val || "—"}</span>
    </div>
  );
}

