import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Loader2, ClipboardCheck } from "lucide-react";
import { SCORE_LABELS } from "@/lib/qc-options";

const emptyForm = {
  lecturer_id: "",
  exam_title_id: "",
  exam_subject_id: "",
  check_date: new Date().toISOString().slice(0, 10),
  qc_member_id: "",
  qc_member_name: "",
  started_on_time: 0,
  finished_on_time: 0,
  introduced_self: null,
  orderliness_note: "",
  orderliness_score: 0,
  content_focus_note: "",
  content_focus_score: 0,
  conducted_test: null,
  qa_observations: "",
  general_observations: "",
  class_recorded: null,
  recording_submitted: null,
};

function ScoreRow({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={value === n ? "default" : "outline"}
            className="w-16 h-9 p-0 flex flex-col leading-none"
            onClick={() => onChange(n)}
          >
            <span className="text-sm font-semibold">{n}</span>
            <span className="text-[9px] opacity-70">{SCORE_LABELS[n]}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function YesNoRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup
        className="flex gap-4"
        value={value === null ? "" : value ? "yes" : "no"}
        onValueChange={(v) => onChange(v === "yes")}
      >
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="yes" id={`${label}-yes`} />
          <Label htmlFor={`${label}-yes`} className="text-sm font-normal">Yes</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="no" id={`${label}-no`} />
          <Label htmlFor={`${label}-no`} className="text-sm font-normal">No</Label>
        </div>
      </RadioGroup>
    </div>
  );
}

export default function QcCheckDialog({ open, onOpenChange, editRecord = null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const [form, setForm] = useState(emptyForm);

  const { data: lecturers = [] } = useQuery({
    queryKey: ["lecturers-active", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecturers")
        .select("id, name, level")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["qc-courses", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_titles")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["qc-subjects", tenantId, form.exam_title_id],
    enabled: !!tenantId && !!form.exam_title_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_subjects")
        .select("id, name, lecturer_id")
        .eq("tenant_id", tenantId)
        .eq("course_id", form.exam_title_id)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-fill the lecturer mapped to the selected subject
  const selectSubject = (subjectId) => {
    const mapped = subjects.find((s) => s.id === subjectId)?.lecturer_id;
    setForm((f) => ({ ...f, exam_subject_id: subjectId, lecturer_id: mapped || f.lecturer_id }));
  };


  // Training Rep members for QC Team Member dropdown
  const { data: trainingReps = [] } = useQuery({
    queryKey: ["training-rep-members", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, church_unit")
        .eq("tenant_id", tenantId)
        .not("church_unit", "is", null)
        .ilike("church_unit", "%Training Rep%")
        .order("first_name");
      if (error) throw error;
      return (data || []).filter((m) => {
        const units = (m.church_unit || "").split(",").map((u) => u.trim().toLowerCase());
        return units.includes("training rep");
      });
    },
  });

  // Signed-in user's member record for this tenant (for auto-fill)
  const { data: currentMember } = useQuery({
    queryKey: ["current-member-for-qc", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, church_unit")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editRecord) {
      setForm({
        lecturer_id: editRecord.lecturer_id || "",
        exam_title_id: editRecord.exam_title_id || "",
        exam_subject_id: editRecord.exam_subject_id || "",
        check_date: editRecord.check_date || new Date().toISOString().slice(0, 10),
        qc_member_id: editRecord.qc_member_id || "",
        qc_member_name: editRecord.qc_member_name || "",
        started_on_time: editRecord.started_on_time || 0,
        finished_on_time: editRecord.finished_on_time || 0,
        introduced_self: editRecord.introduced_self,
        orderliness_note: editRecord.orderliness_note || "",
        orderliness_score: editRecord.orderliness_score || 0,
        content_focus_note: editRecord.content_focus_note || "",
        content_focus_score: editRecord.content_focus_score || 0,
        conducted_test: editRecord.conducted_test,
        qa_observations: editRecord.qa_observations || "",
        general_observations: editRecord.general_observations || "",
        class_recorded: editRecord.class_recorded,
        recording_submitted: editRecord.recording_submitted,
      });
    } else {
      const units = (currentMember?.church_unit || "").split(",").map((u) => u.trim().toLowerCase());
      const isTrainingRep = units.includes("training rep");
      const autoName = isTrainingRep && currentMember
        ? `${currentMember.first_name || ""} ${currentMember.last_name || ""}`.trim()
        : "";
      setForm({
        ...emptyForm,
        qc_member_id: isTrainingRep && currentMember ? currentMember.id : "",
        qc_member_name: autoName,
      });
    }
  }, [open, editRecord, currentMember]);

  const total = useMemo(
    () =>
      (form.started_on_time || 0) +
      (form.finished_on_time || 0) +
      (form.orderliness_score || 0) +
      (form.content_focus_score || 0),
    [form],
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form.lecturer_id) throw new Error("Please select a lecturer");
      if (!form.exam_title_id) throw new Error("Please select a course");
      if (!form.exam_subject_id) throw new Error("Please select a subject");
      if (!form.qc_member_id) throw new Error("Please select a QC team member");

      // Duplicate guard: only one QC per lecturer + subject per tenant
      {
        let dupQ = supabase
          .from("lecturer_qc_checks")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("lecturer_id", form.lecturer_id)
          .eq("exam_subject_id", form.exam_subject_id);
        if (editRecord?.id) dupQ = dupQ.neq("id", editRecord.id);
        const { data: dup, error: dupErr } = await dupQ.limit(1);
        if (dupErr) throw dupErr;
        if (dup && dup.length) {
          throw new Error("A QC check already exists for this lecturer and subject.");
        }
      }

      // Snapshot student's avg rating for this lecturer (scoped to subject)
      let studentAvg = null;
      try {
        const { data: rs } = await supabase
          .from("lecturer_ratings")
          .select("overall_rating")
          .eq("tenant_id", tenantId)
          .eq("lecturer_id", form.lecturer_id)
          .eq("subject_id", form.exam_subject_id);
        if (rs && rs.length) {
          studentAvg = rs.reduce((s, r) => s + (r.overall_rating || 0), 0) / rs.length;
        }
      } catch { /* ignore */ }

      const payload = {
        tenant_id: tenantId,
        lecturer_id: form.lecturer_id,
        exam_title_id: form.exam_title_id || null,
        exam_subject_id: form.exam_subject_id,
        check_date: form.check_date,
        tier: null,
        qc_member_id: form.qc_member_id,
        qc_member_name: form.qc_member_name.trim(),
        started_on_time: form.started_on_time || null,
        finished_on_time: form.finished_on_time || null,
        introduced_self: form.introduced_self,
        orderliness_note: form.orderliness_note.trim() || null,
        orderliness_score: form.orderliness_score || null,
        content_focus_note: form.content_focus_note.trim() || null,
        content_focus_score: form.content_focus_score || null,
        conducted_test: form.conducted_test,
        qa_observations: form.qa_observations.trim() || null,
        general_observations: form.general_observations.trim() || null,
        class_recorded: form.class_recorded,
        recording_submitted: form.recording_submitted,
        total_score: total,
        student_avg_rating: studentAvg,
        created_by: user?.id || null,
      };

      if (editRecord?.id) {
        const { error } = await supabase
          .from("lecturer_qc_checks")
          .update(payload)
          .eq("id", editRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lecturer_qc_checks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecturer-qc-checks"] });
      toast({ title: editRecord ? "QC check updated" : "QC check saved" });
      onOpenChange(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Quality Control Checklist
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            Word of Faith Bible Institute — record class quality against the standard checklist.
          </p>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Lecturer's Name *</Label>
              <Select value={form.lecturer_id} onValueChange={(v) => set("lecturer_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select a lecturer" /></SelectTrigger>
                <SelectContent>
                  {lecturers.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.check_date} onChange={(e) => set("check_date", e.target.value)} />
            </div>
            <div>
              <Label>Course *</Label>
              <Select value={form.exam_title_id} onValueChange={(v) => setForm((f) => ({ ...f, exam_title_id: v, exam_subject_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Select value={form.exam_subject_id} onValueChange={(v) => set("exam_subject_id", v)} disabled={!form.exam_title_id}>
                <SelectTrigger><SelectValue placeholder={form.exam_title_id ? "Select a subject" : "Select a course first"} /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>QC Team Member *</Label>
              <Select
                value={form.qc_member_id}
                onValueChange={(v) => {
                  const m = trainingReps.find((x) => x.id === v);
                  const name = m ? `${m.first_name || ""} ${m.last_name || ""}`.trim() : "";
                  setForm((f) => ({ ...f, qc_member_id: v, qc_member_name: name }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={trainingReps.length ? "Select a Training Rep member" : "No Training Rep members found"} />
                </SelectTrigger>
                <SelectContent>
                  {trainingReps.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {`${m.first_name || ""} ${m.last_name || ""}`.trim() || "Unnamed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <ScoreRow label="1. Timeliness of lecturer (starting on time)" value={form.started_on_time} onChange={(v) => set("started_on_time", v)} />
            <ScoreRow label="2. Timeliness of lecturer (finishing on time)" value={form.finished_on_time} onChange={(v) => set("finished_on_time", v)} />

            <YesNoRow label="3. Lecturer introduced self?" value={form.introduced_self} onChange={(v) => set("introduced_self", v)} />

            <div className="space-y-2">
              <ScoreRow label="4. Orderliness of the class" value={form.orderliness_score} onChange={(v) => set("orderliness_score", v)} />
              <Textarea rows={2} placeholder="Describe orderliness of the class…" value={form.orderliness_note} onChange={(e) => set("orderliness_note", e.target.value)} />
            </div>

            <div className="space-y-2">
              <ScoreRow label="5. Content focus" value={form.content_focus_score} onChange={(v) => set("content_focus_score", v)} />
              <Textarea rows={2} placeholder="Describe content focus…" value={form.content_focus_note} onChange={(e) => set("content_focus_note", e.target.value)} />
            </div>

            <YesNoRow label="6. Lecturer conducted test?" value={form.conducted_test} onChange={(v) => set("conducted_test", v)} />

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">7. Q&A section observations</Label>
              <Textarea rows={2} value={form.qa_observations} onChange={(e) => set("qa_observations", e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">8. General observations</Label>
              <Textarea rows={3} value={form.general_observations} onChange={(e) => set("general_observations", e.target.value)} />
            </div>

            <YesNoRow label="9. This class was recorded" value={form.class_recorded} onChange={(v) => set("class_recorded", v)} />
            <YesNoRow label="10. Recording submitted" value={form.recording_submitted} onChange={(v) => set("recording_submitted", v)} />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Total score (QC Team)</div>
              <div className="text-xs text-muted-foreground">Sum of items 1, 2, 4 and 5</div>
            </div>
            <div className="text-2xl font-bold text-primary">{total}<span className="text-sm text-muted-foreground">/20</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
            {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {editRecord ? "Update" : "Save"} QC Check
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
