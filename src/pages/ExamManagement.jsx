import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import DangerConfirmDialog from "@/components/exams/DangerConfirmDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, Edit, BookOpen, Save, Tag, Layers, Eye, CheckCircle2, Download, Users, QrCode, Search, FileText } from "lucide-react";
import WoFBIRegistrationQRCode from "@/components/exams/WoFBIRegistrationQRCode";
import SubjectManager from "@/components/exams/SubjectManager";
import CourseResultsView from "@/components/exams/CourseResultsView";
import TakeExamDialog from "@/components/exams/TakeExamDialog";
import { useSubFeature } from "@/hooks/useSubFeature";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { getGradeClassification, DEFAULT_GRADE_CLASSIFICATIONS } from "@/lib/grade-utils";
import StatementOfResult from "@/components/exams/StatementOfResult";

const OPTION_LETTERS = ["a", "b", "c", "d"];
const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "fill_in_gap", label: "Fill in the Gap" },
  { value: "drag_and_drop", label: "Drag & Drop (Ordering)" },
];

const emptyQuestion = {
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "a",
  points: 1,
  answer_count: 4,
  question_type: "multiple_choice",
};

const WOFBI_DEFAULT_ABOUT = "Bible School is a structured Bible training programme designed to equip believers with foundational knowledge of God's Word through courses and examinations.";

export default function ExamManagement() {
  const { user, isAdmin, myMember } = useAuth();
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewSubject, setPreviewSubject] = useState(null);

  // Course CRUD state
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(null);
  const [titleForm, setTitleForm] = useState({ name: "", description: "", pass_mark_percentage: 50, registration_open: false, exams_open: false, grade_classifications: DEFAULT_GRADE_CLASSIFICATIONS, send_result_email: true, send_certificate_email: true });
  const [deleteTitleTarget, setDeleteTitleTarget] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showRegistrations, setShowRegistrations] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const { enabled: canCreateCourse } = useSubFeature("wofbi.create_course");
  const { enabled: canRegQr } = useSubFeature("wofbi.registration_qr");

  // Fetch courses (exam_titles)
  const { data: examTitles = [], isLoading: titlesLoading } = useQuery({
    queryKey: ["exam-titles", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("exam_titles").select("*").order("name"));
      if (error) throw error;
      return data;
    },
  });

  // Auto-select first course
  React.useEffect(() => {
    if (examTitles.length > 0 && !selectedCourse) {
      setSelectedCourse(examTitles[0]);
    }
  }, [examTitles, selectedCourse]);

  // Course mutations
  const saveTitleMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingTitle) {
        const { error } = await supabase.from("exam_titles").update(payload).eq("id", editingTitle.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exam_titles").insert(withTenant({ ...payload, created_by: user?.id }));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-titles"] });
      toast({ title: editingTitle ? "Course updated" : "Course created" });
      setTitleDialogOpen(false);
      setEditingTitle(null);
      setTitleForm({ name: "", description: "", pass_mark_percentage: 50, registration_open: false, exams_open: false, grade_classifications: DEFAULT_GRADE_CLASSIFICATIONS, send_result_email: true, send_certificate_email: true });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteTitleMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("exam_titles").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-titles"] });
      toast({ title: "Course deleted" });
      setDeleteTitleTarget(null);
      if (deleteTitleTarget?.id === selectedCourse?.id) { setSelectedCourse(null); setSelectedSubject(null); }
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Questions — scoped to selected subject. Uses admin RPC so the
  // correct_answer column (revoked from authenticated SELECT for security)
  // is returned for admin authoring/review only.
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["exam-questions-by-subject", selectedSubject?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exam_questions_with_answers", {
        _tenant_id: tenantId,
        _subject_id: selectedSubject.id,
        _training_type: null,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSubject?.id && !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ correct_answer, ...payload }) => {
      if (!tenantId) throw new Error("No tenant context");
      let questionId;
      if (editingQuestion) {
        const { error } = await supabase.from("exam_questions").update(payload).eq("id", editingQuestion.id).eq("tenant_id", tenantId);
        if (error) throw error;
        questionId = editingQuestion.id;
      } else {
        const { data, error } = await supabase.from("exam_questions").insert(withTenant(payload)).select("id").single();
        if (error) throw error;
        questionId = data.id;
      }
      // Answer key lives only in exam_question_answers (admin-only RLS)
      const { error: aErr } = await supabase
        .from("exam_question_answers")
        .upsert(
          { question_id: questionId, tenant_id: tenantId, correct_answer },
          { onConflict: "question_id" }
        );
      if (aErr) throw aErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-questions-by-subject"] });
      toast({ title: editingQuestion ? "Question updated" : "Question added" });
      setDialogOpen(false);
      setEditingQuestion(null);
      setForm(emptyQuestion);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("exam_questions").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-questions-by-subject"] });
      toast({ title: "Question deleted" });
      setDeleteTarget(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const activeOptions = OPTION_LETTERS.slice(0, form.answer_count);
  const isMCQ = form.question_type === "multiple_choice";
  const isFillGap = form.question_type === "fill_in_gap";
  const isDragDrop = form.question_type === "drag_and_drop";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.question_text) { toast({ title: "Question text is required", variant: "destructive" }); return; }
    if (isMCQ) {
      if (!form.option_a || !form.option_b) { toast({ title: "At least options A & B are required", variant: "destructive" }); return; }
      if (!activeOptions.includes(form.correct_answer)) { toast({ title: `Correct answer must be one of: ${activeOptions.map(o => o.toUpperCase()).join(", ")}`, variant: "destructive" }); return; }
    }
    if (isFillGap && !form.correct_answer) { toast({ title: "Correct answer is required", variant: "destructive" }); return; }
    if (isDragDrop) {
      if (!form.option_a || !form.option_b) { toast({ title: "At least 2 items required", variant: "destructive" }); return; }
      if (!form.correct_answer) { toast({ title: "Correct order is required", variant: "destructive" }); return; }
    }

    saveMutation.mutate({
      training_type: selectedCourse.name,
      subject_id: selectedSubject.id,
      question_text: form.question_text,
      option_a: isFillGap ? "" : form.option_a,
      option_b: isFillGap ? "" : form.option_b,
      option_c: isFillGap ? "" : (form.answer_count >= 3 ? form.option_c : ""),
      option_d: isFillGap ? "" : (form.answer_count >= 4 ? form.option_d : ""),
      correct_answer: form.correct_answer,
      points: parseInt(form.points) || 1,
      answer_count: isFillGap ? 0 : form.answer_count,
      question_type: form.question_type,
      sort_order: editingQuestion?.sort_order ?? questions.length,
      created_by: user?.id,
    });
  };

  const openEdit = (q) => {
    setEditingQuestion(q);
    setForm({
      question_text: q.question_text, option_a: q.option_a, option_b: q.option_b,
      option_c: q.option_c, option_d: q.option_d, correct_answer: q.correct_answer,
      points: q.points, answer_count: q.answer_count || 4, question_type: q.question_type || "multiple_choice",
    });
    setDialogOpen(true);
  };

  const openNew = () => { setEditingQuestion(null); setForm(emptyQuestion); setDialogOpen(true); };

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === "answer_count") {
      const newOpts = OPTION_LETTERS.slice(0, Number(v));
      if (!newOpts.includes(f.correct_answer) && f.question_type === "multiple_choice") next.correct_answer = "a";
    }
    if (k === "question_type") {
      if (v === "fill_in_gap") { next.correct_answer = ""; next.answer_count = 0; }
      else if (v === "drag_and_drop") { next.correct_answer = ""; next.answer_count = f.answer_count || 4; }
      else { next.correct_answer = "a"; next.answer_count = f.answer_count || 4; }
    }
    return next;
  });

  const questionTypeLabel = (type) => QUESTION_TYPES.find(t => t.value === type)?.label || type;

  // Admin toggle mutations
  const toggleCourseMutation = useMutation({
    mutationFn: async ({ id, field, value }) => {
      const { error } = await supabase.from("exam_titles").update({ [field]: value }).eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-titles"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // If not admin, show member view
  if (!isAdmin) {
    return <MemberExamsView memberId={myMember?.id} memberRecord={myMember} courses={examTitles} loading={titlesLoading} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Bible School Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage certificate courses, subjects, and exam questions</p>
        </div>
        {canRegQr && (
          <Button variant="outline" onClick={() => setQrOpen(true)} className="gap-2">
            <QrCode className="h-4 w-4" /> Registration QR
          </Button>
        )}
      </div>
      <WoFBIRegistrationQRCode open={qrOpen} onOpenChange={setQrOpen} />


      {/* WoFBI About Section (Admin Editable) */}
      <WofbiAboutEditor />

      {/* Certificate Courses */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Certificate Courses
            </CardTitle>
             {canCreateCourse && (
               <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                setEditingTitle(null);
                setTitleForm({ name: "", description: "", pass_mark_percentage: 50, registration_open: false, exams_open: false, grade_classifications: DEFAULT_GRADE_CLASSIFICATIONS, send_result_email: true, send_certificate_email: true });
                setTitleDialogOpen(true);
              }}>
                <Plus className="h-3.5 w-3.5" /> Add Course
              </Button>
             )}
          </div>
        </CardHeader>
        <CardContent>
          {titlesLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : examTitles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No courses yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {examTitles.map(t => (
                <div key={t.id} className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${
                  selectedCourse?.id === t.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted"
                }`} onClick={() => { setSelectedCourse(t); setSelectedSubject(null); setShowResults(false); setShowRegistrations(false); }}>
                  <span className="font-medium">{t.name}</span>
                  <Badge variant="outline" className={`text-[9px] h-4 ${selectedCourse?.id === t.id ? "border-primary-foreground/30 text-primary-foreground" : ""}`}>
                    {t.pass_mark_percentage}%
                  </Badge>
                   {!t.is_active && <Badge variant="secondary" className="text-[9px] h-4">Inactive</Badge>}
                   {t.registration_open && <Badge variant="outline" className="text-[9px] h-4 border-chart-3/40 text-chart-3">Reg Open</Badge>}
                   {t.exams_open && <Badge variant="outline" className="text-[9px] h-4 border-primary/40 text-primary">Exams Open</Badge>}
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" onClick={(e) => {
                    e.stopPropagation();
                    setEditingTitle(t);
                    setTitleForm({ name: t.name, description: t.description || "", pass_mark_percentage: t.pass_mark_percentage || 50, registration_open: !!t.registration_open, exams_open: !!t.exams_open, grade_classifications: t.grade_classifications || DEFAULT_GRADE_CLASSIFICATIONS, send_result_email: t.send_result_email !== false, send_certificate_email: t.send_certificate_email !== false });
                    setTitleDialogOpen(true);
                  }}>
                    <Edit className="h-3 w-3" />
                  </button>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTitleTarget(t); }}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCourse && (
        <>
          {/* Toggle: Subjects vs Results */}
          <div className="flex gap-2">
            <Button variant={!showResults && !showRegistrations ? "default" : "outline"} size="sm" onClick={() => { setShowResults(false); setShowRegistrations(false); }} className="gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Subjects & Questions
            </Button>
            <Button variant={showResults ? "default" : "outline"} size="sm" onClick={() => { setShowResults(true); setShowRegistrations(false); }} className="gap-1.5">
              Course Results
            </Button>
            <Button variant={showRegistrations ? "default" : "outline"} size="sm" onClick={() => { setShowRegistrations(true); setShowResults(false); }} className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Registrations
            </Button>
          </div>

          {showRegistrations ? (
            <CourseRegistrationsView course={selectedCourse} />
          ) : showResults ? (
            <CourseResultsView course={selectedCourse} />
          ) : (
            <>
              {/* Subject Manager */}
              <SubjectManager
                course={selectedCourse}
                onSelectSubject={(s) => setSelectedSubject(s)}
                selectedSubjectId={selectedSubject?.id}
              />

              {/* Questions for selected subject */}
              {selectedSubject && (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">
                      Questions — {selectedSubject.name}
                    </h3>
                    <div className="flex gap-2">
                      {questions.length > 0 && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreviewSubject(selectedSubject)}>
                          <Eye className="h-3.5 w-3.5" /> Preview Exam
                        </Button>
                      )}
                      <Button size="sm" className="gap-1.5" onClick={openNew}>
                        <Plus className="h-4 w-4" /> Add Question
                      </Button>
                    </div>
                  </div>

                  <Card className="border-0 shadow-sm">
                    <CardContent className="pt-6">
                      {isLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                      ) : questions.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No questions yet for this subject.</p>
                      ) : (
                        <div className="space-y-3">
                          {questions.map((q, idx) => {
                            const qType = q.question_type || "multiple_choice";
                            const qOpts = OPTION_LETTERS.slice(0, q.answer_count || 4);
                            return (
                              <div key={q.id} className="p-4 rounded-lg border border-border bg-card">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">
                                      <span className="text-muted-foreground mr-2">{idx + 1}.</span>{q.question_text}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <Badge variant="secondary" className="text-[10px]">{questionTypeLabel(qType)}</Badge>
                                    </div>
                                    {qType === "multiple_choice" && (
                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                        {qOpts.map(opt => q[`option_${opt}`] && (
                                          <div key={opt} className={`text-xs px-2 py-1.5 rounded ${q.correct_answer === opt ? "bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/30" : "bg-muted text-muted-foreground"}`}>
                                            <span className="font-bold uppercase mr-1">{opt}.</span>{q[`option_${opt}`]}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {qType === "fill_in_gap" && <p className="text-xs text-emerald-600 mt-2">Answer: <strong>{q.correct_answer}</strong></p>}
                                    {qType === "drag_and_drop" && (
                                      <div className="mt-2 space-y-1">
                                        <div className="flex flex-wrap gap-1.5">
                                          {qOpts.map(opt => q[`option_${opt}`] && (
                                            <span key={opt} className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">{opt.toUpperCase()}. {q[`option_${opt}`]}</span>
                                          ))}
                                        </div>
                                        <p className="text-xs text-emerald-600">Correct order: <strong>{q.correct_answer}</strong></p>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Badge variant="outline" className="text-[10px]">{q.points} pt{q.points !== 1 ? "s" : ""}</Badge>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}><Edit className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(q)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Delete Question */}
      <DangerConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Question"
        entityName={deleteTarget ? `Q${(deleteTarget.sort_order ?? 0) + 1}` : ""}
        confirmText="DELETE"
        impacts={[
          "This question and all member answers tied to it will be permanently deleted.",
          "Existing exam attempts will keep their score but lose this question's record.",
        ]}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      {/* Delete Course */}
      <DangerConfirmDialog
        open={!!deleteTitleTarget}
        onOpenChange={(open) => !open && setDeleteTitleTarget(null)}
        title="Delete Course"
        entityName={deleteTitleTarget?.name || ""}
        impacts={[
          "All subjects under this course will be permanently deleted.",
          "All questions, member registrations and exam attempts for this course will be permanently deleted.",
          "Issued certificates linked to this course may become invalid.",
        ]}
        isPending={deleteTitleMutation.isPending}
        onConfirm={() => deleteTitleTarget && deleteTitleMutation.mutate(deleteTitleTarget.id)}
      />

      {/* Course Dialog */}
      <Dialog open={titleDialogOpen} onOpenChange={setTitleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingTitle ? "Edit Course" : "Add Certificate Course"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!titleForm.name.trim()) { toast({ title: "Course name is required", variant: "destructive" }); return; }
            saveTitleMutation.mutate({
              name: titleForm.name.trim(),
              description: titleForm.description.trim() || null,
              pass_mark_percentage: Number(titleForm.pass_mark_percentage) || 50,
              is_active: true,
              registration_open: titleForm.registration_open,
              exams_open: titleForm.exams_open,
              grade_classifications: titleForm.grade_classifications,
              send_result_email: titleForm.send_result_email,
              send_certificate_email: titleForm.send_certificate_email,
            });
          }} className="space-y-4">
            <div><Label>Course Name *</Label><Input value={titleForm.name} onChange={e => setTitleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BCC, LCC" /></div>
            <div><Label>Description</Label><Input value={titleForm.description} onChange={e => setTitleForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" /></div>
            <div><Label>Aggregate Pass Mark (%)</Label><Input type="number" min="0" max="100" value={titleForm.pass_mark_percentage} onChange={e => setTitleForm(f => ({ ...f, pass_mark_percentage: e.target.value }))} className="w-28" /></div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <Label htmlFor="reg-open" className="cursor-pointer">Registration Open</Label>
              <Switch id="reg-open" checked={titleForm.registration_open} onCheckedChange={v => setTitleForm(f => ({ ...f, registration_open: v }))} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <Label htmlFor="exams-open" className="cursor-pointer">Exams Open</Label>
              <Switch id="exams-open" checked={titleForm.exams_open} onCheckedChange={v => setTitleForm(f => ({ ...f, exams_open: v }))} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <Label htmlFor="send-result" className="cursor-pointer">Email Result Statement on Completion</Label>
              <Switch id="send-result" checked={titleForm.send_result_email} onCheckedChange={v => setTitleForm(f => ({ ...f, send_result_email: v }))} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
              <Label htmlFor="send-cert" className="cursor-pointer">Email Certificate on Completion</Label>
              <Switch id="send-cert" checked={titleForm.send_certificate_email} onCheckedChange={v => setTitleForm(f => ({ ...f, send_certificate_email: v }))} />
            </div>
            {/* Grade Classifications Editor */}
            <div className="space-y-2">
              <Label>Grade Classifications</Label>
              <div className="space-y-2">
                {(titleForm.grade_classifications || []).map((gc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={gc.label}
                      onChange={e => {
                        const updated = [...titleForm.grade_classifications];
                        updated[idx] = { ...updated[idx], label: e.target.value };
                        setTitleForm(f => ({ ...f, grade_classifications: updated }));
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
                        const updated = [...titleForm.grade_classifications];
                        updated[idx] = { ...updated[idx], min_percentage: Number(e.target.value) };
                        setTitleForm(f => ({ ...f, grade_classifications: updated }));
                      }}
                      className="w-20"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      setTitleForm(f => ({ ...f, grade_classifications: f.grade_classifications.filter((_, i) => i !== idx) }));
                    }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  setTitleForm(f => ({ ...f, grade_classifications: [...(f.grade_classifications || []), { label: "", min_percentage: 0 }] }));
                }}>
                  <Plus className="h-3 w-3" /> Add Grade
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Highest percentage first. Students below the lowest threshold get "Fail".</p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveTitleMutation.isPending}>
                {saveTitleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingTitle ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Question Type</Label>
              <Select value={form.question_type} onValueChange={v => set("question_type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Question *</Label>
              <Textarea value={form.question_text} onChange={e => set("question_text", e.target.value)} rows={3} placeholder={isFillGap ? "Use ___ for the blank" : ""} />
            </div>
            {isMCQ && (
              <>
                <div>
                  <Label>Number of Options</Label>
                  <Select value={String(form.answer_count)} onValueChange={v => set("answer_count", Number(v))}>
                    <SelectTrigger className="w-32 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 (A–B)</SelectItem>
                      <SelectItem value="3">3 (A–C)</SelectItem>
                      <SelectItem value="4">4 (A–D)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label>Options *</Label>
                  {activeOptions.map(opt => (
                    <div key={opt} className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-muted-foreground w-5">{opt}.</span>
                      <Input value={form[`option_${opt}`]} onChange={e => set(`option_${opt}`, e.target.value)} placeholder={`Option ${opt.toUpperCase()}`} />
                    </div>
                  ))}
                </div>
                <div>
                  <Label>Correct Answer *</Label>
                  <RadioGroup value={form.correct_answer} onValueChange={v => set("correct_answer", v)} className="flex gap-4 mt-2">
                    {activeOptions.map(opt => (
                      <div key={opt} className="flex items-center gap-1.5">
                        <RadioGroupItem value={opt} id={`correct-${opt}`} />
                        <Label htmlFor={`correct-${opt}`} className="text-sm uppercase font-semibold">{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </>
            )}
            {isFillGap && (
              <div>
                <Label>Correct Answer *</Label>
                <Input value={form.correct_answer} onChange={e => set("correct_answer", e.target.value)} placeholder="Expected answer" />
                <p className="text-xs text-muted-foreground mt-1">Case-insensitive matching.</p>
              </div>
            )}
            {isDragDrop && (
              <>
                <div>
                  <Label>Number of Items</Label>
                  <Select value={String(form.answer_count)} onValueChange={v => set("answer_count", Number(v))}>
                    <SelectTrigger className="w-32 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 items</SelectItem>
                      <SelectItem value="3">3 items</SelectItem>
                      <SelectItem value="4">4 items</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label>Items *</Label>
                  {activeOptions.map(opt => (
                    <div key={opt} className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-muted-foreground w-5">{opt}.</span>
                      <Input value={form[`option_${opt}`]} onChange={e => set(`option_${opt}`, e.target.value)} placeholder={`Item ${opt.toUpperCase()}`} />
                    </div>
                  ))}
                </div>
                <div>
                  <Label>Correct Order *</Label>
                  <Input value={form.correct_answer} onChange={e => set("correct_answer", e.target.value)} placeholder={`e.g. ${activeOptions.reverse().join(",")}`} />
                  <p className="text-xs text-muted-foreground mt-1">Comma-separated letters in correct order</p>
                </div>
              </>
            )}
            <div><Label>Points</Label><Input type="number" min="1" value={form.points} onChange={e => set("points", e.target.value)} className="w-24" /></div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingQuestion ? "Update" : "Add"} Question
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Exam Dialog */}
      {previewSubject && (
        <TakeExamDialog
          open={!!previewSubject}
          onOpenChange={(open) => { if (!open) setPreviewSubject(null); }}
          trainingType={selectedCourse?.name}
          memberId={null}
          subjectId={previewSubject.id}
          subjectName={previewSubject.name}
          previewMode
        />
      )}
    </div>
  );
}

function CourseRegistrationsView({ course }) {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["course-registrations", course.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_registrations")
        .select("id, registered_at, member_id, session_id, exam_sessions(name), members(first_name, last_name, email, phone, user_id)")
        .eq("course_id", course.id)
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!course?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("course_registrations").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-registrations", course.id] });
      toast({ title: "Registration removed" });
      setDeleteTarget(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filteredRegistrations = registrations.filter(r => {
    if (sourceFilter === "member" && !r.members?.user_id) return false;
    if (sourceFilter === "public" && r.members?.user_id) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const name = `${r.members?.first_name || ""} ${r.members?.last_name || ""}`.toLowerCase();
      if (!name.includes(s) && !(r.members?.email || "").toLowerCase().includes(s) && !(r.members?.phone || "").includes(s)) return false;
    }
    return true;
  });

  const downloadCSV = () => {
    const headers = ["Name", "Email", "Phone", "Source", "Session", "Registered At"];
    const rows = filteredRegistrations.map(r => [
      `${r.members?.first_name || ""} ${r.members?.last_name || ""}`.trim(),
      r.members?.email || "",
      r.members?.phone || "",
      r.members?.user_id ? "Member" : "QR / Public",
      r.exam_sessions?.name || "—",
      new Date(r.registered_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${course.name}_registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Registrations — {course.name}
            <Badge variant="secondary" className="ml-2">{filteredRegistrations.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-8 w-[200px] pl-8 text-xs"
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="public">QR / Public</SelectItem>
              </SelectContent>
            </Select>
            {filteredRegistrations.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCSV}>
                <Download className="h-3.5 w-3.5" /> Download CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filteredRegistrations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{registrations.length > 0 ? "No registrations match the selected filter." : "No members registered for this course yet."}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                   <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">Registered</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.members?.first_name} {r.members?.last_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.members?.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.members?.phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.members?.user_id ? "default" : "outline"}>
                        {r.members?.user_id ? "Member" : "QR / Public"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(r.registered_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(r)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <DangerConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Remove Registration"
        entityName={deleteTarget ? `${deleteTarget.members?.first_name || ""} ${deleteTarget.members?.last_name || ""}`.trim() : ""}
        confirmText="DELETE"
        confirmLabel="Remove"
        impacts={[
          `${deleteTarget?.members?.first_name || "The member"}'s registration for "${course.name}" will be removed.`,
          "Existing exam attempts and results are NOT deleted — only the enrolment record.",
        ]}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </Card>
  );
}

function WofbiAboutEditor() {
  const qc = useQueryClient();
  const { tenantId, withTenant } = useTenantQuery();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: aboutText = WOFBI_DEFAULT_ABOUT } = useQuery({
    queryKey: ["app-settings", "wofbi_about", tenantId],
    queryFn: async () => {
      let q = supabase.from("app_settings").select("value").eq("key", "wofbi_about");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return typeof data?.value === "string" ? data.value : WOFBI_DEFAULT_ABOUT;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (text) => {
      const { error } = await supabase.from("app_settings").upsert(withTenant({ key: "wofbi_about", value: text }), { onConflict: "key,tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings", "wofbi_about", tenantId] });
      toast({ title: "Bible School description updated" });
      setEditing(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> About Bible School
          </CardTitle>
          {!editing && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setDraft(aboutText); setEditing(true); }}>
              <Edit className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} placeholder="Describe what Bible School is..." />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" className="gap-1.5" onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{aboutText}</p>
        )}
      </CardContent>
    </Card>
  );
}

function WofbiAboutDisplay() {
  const { tenantId } = useTenantQuery();
  const { data: aboutText = WOFBI_DEFAULT_ABOUT } = useQuery({
    queryKey: ["app-settings", "wofbi_about", tenantId],
    queryFn: async () => {
      let q = supabase.from("app_settings").select("value").eq("key", "wofbi_about");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return typeof data?.value === "string" ? data.value : WOFBI_DEFAULT_ABOUT;
    },
  });

  if (!aboutText) return null;

  return (
    <Card className="border-0 shadow-sm bg-primary/5">
      <CardContent className="p-4">
        <p className="text-sm text-foreground leading-relaxed">{aboutText}</p>
      </CardContent>
    </Card>
  );
}

function MemberExamsView({ memberId, memberRecord, courses, loading }) {
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const [examSelection, setExamSelection] = useState(null);
  const [statementCourse, setStatementCourse] = useState(null);

  const { data: registrations = [], isLoading: regLoading } = useQuery({
    queryKey: ["my-course-registrations", memberId, tenantId],
    queryFn: async () => {
      let query = supabase.from("course_registrations").select("course_id").eq("member_id", memberId);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return data.map(r => r.course_id);
    },
    enabled: !!memberId,
  });

  const { data: allSubjects = [] } = useQuery({
    queryKey: ["all-exam-subjects", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("exam_subjects").select("*").eq("is_active", true).order("sort_order"));
      if (error) throw error;
      return data;
    },
  });

  const { data: myAttempts = [] } = useQuery({
    queryKey: ["my-course-attempts", memberId, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("exam_attempts")
        .select("subject_id, training_type, score, total_points, passed, retake_allowed")
        .eq("member_id", memberId);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
  });

  const registerMutation = useMutation({
    mutationFn: async (courseId) => {
      const { error } = await supabase.from("course_registrations").insert(withTenant({ member_id: memberId, course_id: courseId }));
      if (error) throw error;
      return courseId;
    },
    onSuccess: (courseId) => {
      qc.invalidateQueries({ queryKey: ["my-course-registrations"] });
      toast({ title: "Registered successfully!" });
      // Send registration confirmation email
      const course = courses?.find(c => c.id === courseId);
      if (memberRecord?.email) {
        supabase.functions.invoke("send-course-registration-email", {
          body: {
            email: memberRecord.email,
            first_name: memberRecord.first_name || "Friend",
            course_name: course?.name || "Bible School Course",
            tenant_id: tenantId,
          },
        }).catch(err => console.error("Registration email failed:", err));
      }
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bestBySubject = {};
  myAttempts.forEach(a => {
    if (!a.subject_id) return;
    const pct = a.total_points > 0 ? a.score / a.total_points : 0;
    if (!bestBySubject[a.subject_id] || pct > (bestBySubject[a.subject_id].score / bestBySubject[a.subject_id].total_points)) {
      bestBySubject[a.subject_id] = a;
    }
  });

  if (loading || regLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!memberId) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please complete your member profile first to access Bible School.</p>
      </div>
    );
  }

  const activeCourses = courses.filter(c => c.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
           <BookOpen className="h-5 w-5 text-primary" /> Bible School
         </h1>
         <p className="text-sm text-muted-foreground mt-1">Register for courses and take your Bible School exams</p>
      </div>

      <WofbiAboutDisplay />

      {activeCourses.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No courses available.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeCourses.map(course => {
            const isRegistered = registrations.includes(course.id);
            const subjects = allSubjects.filter(s => s.course_id === course.id);
            const completedSubjectIds = subjects.filter(s => bestBySubject[s.id]).map(s => s.id);
            const totalScore = completedSubjectIds.reduce((sum, id) => sum + (bestBySubject[id]?.score || 0), 0);
            const totalPoints = completedSubjectIds.reduce((sum, id) => sum + (bestBySubject[id]?.total_points || 0), 0);
            const aggPct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
            const allDone = subjects.length > 0 && completedSubjectIds.length === subjects.length;
            const passed = allDone && aggPct >= course.pass_mark_percentage;

            return (
              <Card key={course.id} className="border-0 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{course.name}</h3>
                      {course.description && <p className="text-xs text-muted-foreground">{course.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isRegistered && (
                        <Badge variant="outline" className="text-xs border-chart-3/40 text-chart-3">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Registered
                        </Badge>
                      )}
                      {allDone && course.send_result_email && (
                        <Badge variant={passed ? "default" : "destructive"} className="text-xs">
                          {passed ? getGradeClassification(aggPct, course.grade_classifications || DEFAULT_GRADE_CLASSIFICATIONS) : "Fail"}
                        </Badge>
                      )}
                      {allDone && course.send_result_email && (
                        <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setStatementCourse(course)}>
                          <FileText className="h-3 w-3" /> Statement
                        </Button>
                      )}
                    </div>
                  </div>

                  {!isRegistered ? (
                    course.registration_open ? (
                      <Button size="sm" onClick={() => registerMutation.mutate(course.id)} disabled={registerMutation.isPending} className="gap-1.5">
                        {registerMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Register for {course.name}
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Registration is currently closed.</p>
                    )
                  ) : !course.exams_open ? (
                    <p className="text-xs text-muted-foreground italic">Bible School exams are not yet available. Please wait for the admin to open the exam window.</p>
                  ) : subjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No subjects configured yet.</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {completedSubjectIds.length}/{subjects.length} subjects completed
                        {course.send_result_email && totalPoints > 0 && ` · Aggregate: ${Math.round(aggPct)}%`}
                        {course.send_result_email && ` · Pass mark: ${course.pass_mark_percentage}%`}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {subjects.map(s => {
                          const taken = !!bestBySubject[s.id];
                          const best = bestBySubject[s.id];
                          const bestPct = best && best.total_points > 0 ? (best.score / best.total_points) * 100 : 0;
                          const subjectPassMark = s.pass_mark_percentage ?? 50;
                          const hasPassed = taken && bestPct >= subjectPassMark;
                          const canRetake = taken && !hasPassed && myAttempts.some(a => a.subject_id === s.id && a.retake_allowed === true);
                          const isDisabled = taken && !canRetake;
                          return (
                            <Button
                              key={s.id}
                              variant={taken ? "secondary" : "outline"}
                              size="sm"
                              disabled={isDisabled}
                              onClick={() => setExamSelection({ type: course.name, subjectId: s.id, subjectName: s.name })}
                              className="gap-1.5"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              {s.name} {taken ? (canRetake ? "↻ Retake" : (course.send_result_email ? `✓ ${best.score}/${best.total_points}` : "✓ Completed")) : ""}
                            </Button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TakeExamDialog
        open={!!examSelection}
        onOpenChange={(v) => { if (!v) { setExamSelection(null); qc.invalidateQueries({ queryKey: ["my-course-attempts"] }); } }}
        trainingType={examSelection?.type}
        memberId={memberId}
        subjectId={examSelection?.subjectId}
        subjectName={examSelection?.subjectName}
      />

      {statementCourse && (() => {
        const subjects = allSubjects.filter(s => s.course_id === statementCourse.id);
        const memberSubs = {};
        subjects.forEach(s => {
          if (bestBySubject[s.id]) {
            memberSubs[s.id] = { score: bestBySubject[s.id].score, total_points: bestBySubject[s.id].total_points };
          }
        });
        return (
          <StatementOfResult
            open={!!statementCourse}
            onOpenChange={(v) => { if (!v) setStatementCourse(null); }}
            member={{ id: memberId, name: "My Results" }}
            course={statementCourse}
            subjects={subjects}
            memberSubjects={memberSubs}
          />
        );
      })()}
    </div>
  );
}
