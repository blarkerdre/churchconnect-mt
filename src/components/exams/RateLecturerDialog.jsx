import { useEffect, useState } from "react";
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
import { Loader2, Star } from "lucide-react";

const QUESTIONS = [
  {
    key: "session_description", label: "1. How would you describe this session?",
    options: [
      ["preaching", "Preaching"], ["teaching", "Teaching"], ["impartation", "Impartation"],
      ["all", "All of them"], ["none", "None of them"],
    ],
  },
  {
    key: "delivery", label: "2. How was the delivery of the lesson?",
    options: [
      ["clear_simple", "Clear & Simple"], ["interactive", "Interactive"], ["just_right", "Just right"],
      ["not_clear", "Not clear"], ["difficult", "Difficult to understand"],
    ],
  },
  {
    key: "time_keeping", label: "3. How was the lecturer's time keeping?",
    options: [
      ["on_time", "On time"], ["too_long", "Too long"], ["too_short", "Too short"],
      ["just_right", "Just right"], ["not_sure", "Not sure"],
    ],
  },
  {
    key: "class_atmosphere", label: "4. Class atmosphere — Would you say the lecturer was:",
    options: [
      ["in_control", "In control of the class"], ["unable_to_control", "Unable to control the class"],
      ["balance_right", "The balance was right"], ["not_sure", "Not sure"],
    ],
  },
  {
    key: "test_quality", label: "5. Would you say the test was:",
    options: [
      ["too_hard", "Too hard"], ["too_simple", "Too simple"],
      ["just_right", "Just right"], ["not_sure", "Not sure"],
    ],
  },
  {
    key: "have_again", label: "6. Would you like to have this lecturer again?",
    options: [
      ["yes", "Yes"], ["no", "No"], ["maybe", "Maybe"], ["never", "Never"], ["unsure", "Unsure"],
    ],
  },
];

const emptyForm = {
  course_id: "",
  subject_id: "",
  lecturer_id: "",
  
  session_description: "",
  delivery: "",
  time_keeping: "",
  class_atmosphere: "",
  test_quality: "",
  have_again: "",
  overall_rating: 0,
  comments: "",
};

export default function RateLecturerDialog({ open, onOpenChange }) {
  const qc = useQueryClient();
  const { user, myMember } = useAuth();
  const { tenantId } = useTenantQuery();
  const [form, setForm] = useState(emptyForm);

  const { data: lecturers = [], isLoading: lecLoading } = useQuery({
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
    queryKey: ["rate-courses", tenantId],
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
    queryKey: ["rate-subjects", tenantId, form.course_id],
    enabled: !!tenantId && !!form.course_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_subjects")
        .select("id, name, lecturer_id")
        .eq("tenant_id", tenantId)
        .eq("course_id", form.course_id)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const mappedLecturerId = subjects.find((s) => s.id === form.subject_id)?.lecturer_id || "";

  useEffect(() => {
    if (!open) setForm(emptyForm);
  }, [open]);

  // Load existing rating for selected subject to allow edit (one rating per subject per student)
  const [existingFound, setExistingFound] = useState(false);
  useEffect(() => {
    if (!form.subject_id || !user?.id || !tenantId) { setExistingFound(false); return; }
    (async () => {
      const { data } = await supabase
        .from("lecturer_ratings")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("subject_id", form.subject_id)
        .eq("submitted_by", user.id)
        .maybeSingle();
      if (data) {
        setExistingFound(true);
        setForm((f) => ({
          ...f,
          lecturer_id: data.lecturer_id || f.lecturer_id,
          session_description: data.session_description || "",
          delivery: data.delivery || "",
          time_keeping: data.time_keeping || "",
          class_atmosphere: data.class_atmosphere || "",
          test_quality: data.test_quality || "",
          have_again: data.have_again || "",
          overall_rating: data.overall_rating || 0,
          comments: data.comments || "",
        }));
      } else {
        setExistingFound(false);
        setForm((f) => ({
          ...f,
          session_description: "",
          delivery: "",
          time_keeping: "",
          class_atmosphere: "",
          test_quality: "",
          have_again: "",
          overall_rating: 0,
          comments: "",
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.subject_id]);


  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form.course_id) throw new Error("Please select a course");
      if (!form.subject_id) throw new Error("Please select a subject");
      if (!form.lecturer_id) throw new Error("Please select a lecturer");
      if (!form.overall_rating) throw new Error("Please select an overall rating (1–10)");
      const payload = {
        tenant_id: tenantId,
        course_id: form.course_id,
        subject_id: form.subject_id,
        lecturer_id: form.lecturer_id,
        member_id: myMember?.id || null,
        submitted_by: user.id,
        level: null,
        session_description: form.session_description || null,
        delivery: form.delivery || null,
        time_keeping: form.time_keeping || null,
        class_atmosphere: form.class_atmosphere || null,
        test_quality: form.test_quality || null,
        have_again: form.have_again || null,
        overall_rating: form.overall_rating,
        comments: form.comments.trim() || null,
      };
      const { error } = await supabase
        .from("lecturer_ratings")
        .upsert(payload, { onConflict: "tenant_id,subject_id,submitted_by" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecturer-ratings"] });
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
      onOpenChange(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isLoading = lecLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" /> Rate the Lecturer
          </DialogTitle>
          <p className="text-xs text-muted-foreground pt-1">
            We are continually committed to improving the standard of the institute — please share your feedback on how the lectures were delivered. You can rate each subject once.
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : lecturers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No lecturers are available for rating yet.</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Course *</Label>
                <Select value={form.course_id} onValueChange={(v) => setForm((f) => ({ ...f, course_id: v, subject_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Subject *</Label>
                <Select value={form.subject_id} onValueChange={(v) => set("subject_id", v)} disabled={!form.course_id}>
                  <SelectTrigger><SelectValue placeholder={form.course_id ? "Select a subject" : "Select a course first"} /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lecturer's Name *</Label>
                <Select value={form.lecturer_id} onValueChange={(v) => set("lecturer_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Select a lecturer" /></SelectTrigger>
                  <SelectContent>
                    {lecturers.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {existingFound && (
              <p className="text-xs text-primary">
                You already rated this subject — submitting will update your feedback.
              </p>
            )}

            {QUESTIONS.map((q) => (
              <div key={q.key} className="space-y-2">
                <Label className="text-sm font-medium">{q.label}</Label>
                <RadioGroup value={form[q.key]} onValueChange={(v) => set(q.key, v)} className="flex flex-wrap gap-x-4 gap-y-2">
                  {q.options.map(([val, lbl]) => (
                    <div key={val} className="flex items-center gap-2">
                      <RadioGroupItem value={val} id={`${q.key}-${val}`} />
                      <Label htmlFor={`${q.key}-${val}`} className="text-sm font-normal cursor-pointer">{lbl}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            ))}

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                7. On a scale of 1–10 (1 lowest, 10 highest), how would you rate this lecturer?
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={form.overall_rating === n ? "default" : "outline"}
                    className="w-10 h-10 p-0"
                    onClick={() => set("overall_rating", n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Additional comments (optional)</Label>
              <Textarea rows={3} maxLength={1000} value={form.comments} onChange={(e) => set("comments", e.target.value)} />
            </div>

            <p className="text-xs text-muted-foreground italic">
              All information will be treated confidentially under the terms of the Data Protection Act / GDPR.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending || lecturers.length === 0}>
            {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
