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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, Edit, BookOpen, Save, Tag, Layers, Eye, CheckCircle2 } from "lucide-react";
import SubjectManager from "@/components/exams/SubjectManager";
import CourseResultsView from "@/components/exams/CourseResultsView";
import TakeExamDialog from "@/components/exams/TakeExamDialog";

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

export default function ExamManagement() {
  const { user, isAdmin, myMember } = useAuth();
  const qc = useQueryClient();
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
  const [titleForm, setTitleForm] = useState({ name: "", description: "", pass_mark_percentage: 50, registration_open: false, exams_open: false });
  const [deleteTitleTarget, setDeleteTitleTarget] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Fetch courses (exam_titles)
  const { data: examTitles = [], isLoading: titlesLoading } = useQuery({
    queryKey: ["exam-titles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_titles").select("*").order("name");
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
        const { error } = await supabase.from("exam_titles").update(payload).eq("id", editingTitle.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exam_titles").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-titles"] });
      toast({ title: editingTitle ? "Course updated" : "Course created" });
      setTitleDialogOpen(false);
      setEditingTitle(null);
      setTitleForm({ name: "", description: "", pass_mark_percentage: 50, registration_open: false, exams_open: false });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteTitleMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("exam_titles").delete().eq("id", id);
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

  // Questions — scoped to selected subject
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["exam-questions-by-subject", selectedSubject?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("subject_id", selectedSubject.id)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedSubject?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editingQuestion) {
        const { error } = await supabase.from("exam_questions").update(payload).eq("id", editingQuestion.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("exam_questions").insert(payload);
        if (error) throw error;
      }
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
      const { error } = await supabase.from("exam_questions").delete().eq("id", id);
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
      const { error } = await supabase.from("exam_titles").update({ [field]: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-titles"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // If not admin, show member view
  if (!isAdmin) {
    return <MemberExamsView memberId={myMember?.id} courses={examTitles} loading={titlesLoading} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Exam Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage certificate courses, subjects, and exam questions</p>
        </div>
      </div>


      {/* Certificate Courses */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Certificate Courses
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
              setEditingTitle(null);
              setTitleForm({ name: "", description: "", pass_mark_percentage: 50 });
              setTitleDialogOpen(true);
            }}>
              <Plus className="h-3.5 w-3.5" /> Add Course
            </Button>
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
                }`} onClick={() => { setSelectedCourse(t); setSelectedSubject(null); setShowResults(false); }}>
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
                    setTitleForm({ name: t.name, description: t.description || "", pass_mark_percentage: t.pass_mark_percentage || 50 });
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
            <Button variant={!showResults ? "default" : "outline"} size="sm" onClick={() => setShowResults(false)} className="gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Subjects & Questions
            </Button>
            <Button variant={showResults ? "default" : "outline"} size="sm" onClick={() => setShowResults(true)} className="gap-1.5">
              Course Results
            </Button>
          </div>

          {showResults ? (
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
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Question</AlertDialogTitle><AlertDialogDescription>Are you sure? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Course */}
      <AlertDialog open={!!deleteTitleTarget} onOpenChange={(open) => !open && setDeleteTitleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Course</AlertDialogTitle><AlertDialogDescription>Delete "{deleteTitleTarget?.name}"? This removes all subjects and questions.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTitleTarget && deleteTitleMutation.mutate(deleteTitleTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteTitleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            });
          }} className="space-y-4">
            <div><Label>Course Name *</Label><Input value={titleForm.name} onChange={e => setTitleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BCC, LCC" /></div>
            <div><Label>Description</Label><Input value={titleForm.description} onChange={e => setTitleForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" /></div>
            <div><Label>Aggregate Pass Mark (%)</Label><Input type="number" min="0" max="100" value={titleForm.pass_mark_percentage} onChange={e => setTitleForm(f => ({ ...f, pass_mark_percentage: e.target.value }))} className="w-28" /></div>
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
