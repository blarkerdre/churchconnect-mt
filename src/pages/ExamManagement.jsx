import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Plus, Trash2, Edit, BookOpen, Save, Tag } from "lucide-react";
import { useAppSetting } from "@/hooks/useAppSetting";
import ExamSessionManager from "@/components/exams/ExamSessionManager";

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
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Exam Titles CRUD state
  const [titleDialogOpen, setTitleDialogOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(null);
  const [titleForm, setTitleForm] = useState({ name: "", description: "" });
  const [deleteTitleTarget, setDeleteTitleTarget] = useState(null);

  // Fetch dynamic exam titles
  const { data: examTitles = [], isLoading: titlesLoading } = useQuery({
    queryKey: ["exam-titles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_titles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-select first title
  React.useEffect(() => {
    if (examTitles.length > 0 && !selectedType) {
      setSelectedType(examTitles[0].name);
    }
  }, [examTitles, selectedType]);

  // Exam title mutations
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
      toast({ title: editingTitle ? "Exam title updated" : "Exam title created" });
      setTitleDialogOpen(false);
      setEditingTitle(null);
      setTitleForm({ name: "", description: "" });
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
      toast({ title: "Exam title deleted" });
      setDeleteTitleTarget(null);
      if (deleteTitleTarget?.name === selectedType) setSelectedType("");
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Per-type pass mark
  const { data: globalPassMark } = useAppSetting("exam_pass_percentage", [70]);
  const globalThreshold = Array.isArray(globalPassMark) ? Number(globalPassMark[0]) || 70 : 70;

  const { data: typePassMarkSetting } = useQuery({
    queryKey: ["app-setting", `exam_pass_mark_${selectedType}`],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", `exam_pass_mark_${selectedType}`)
        .maybeSingle();
      return data?.value;
    },
    enabled: !!selectedType,
  });

  const currentPassMark = typePassMarkSetting != null ? Number(typePassMarkSetting) : globalThreshold;
  const [passMarkInput, setPassMarkInput] = useState("");

  React.useEffect(() => {
    setPassMarkInput(String(currentPassMark));
  }, [currentPassMark, selectedType]);

  const savePassMarkMutation = useMutation({
    mutationFn: async (value) => {
      const key = `exam_pass_mark_${selectedType}`;
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: Number(value), updated_by: user?.id })
          .eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key, value: Number(value), updated_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-setting", `exam_pass_mark_${selectedType}`] });
      toast({ title: `Pass mark for ${selectedType} updated` });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["exam-questions", selectedType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("training_type", selectedType)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedType,
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["exam-attempts-summary", selectedType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, members(first_name, last_name)")
        .eq("training_type", selectedType)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedType,
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
      qc.invalidateQueries({ queryKey: ["exam-questions"] });
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
      qc.invalidateQueries({ queryKey: ["exam-questions"] });
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
    if (!form.question_text) {
      toast({ title: "Question text is required", variant: "destructive" });
      return;
    }

    if (isMCQ) {
      if (!form.option_a || !form.option_b) {
        toast({ title: "At least options A & B are required for multiple choice", variant: "destructive" });
        return;
      }
      if (!activeOptions.includes(form.correct_answer)) {
        toast({ title: `Correct answer must be one of: ${activeOptions.map(o => o.toUpperCase()).join(", ")}`, variant: "destructive" });
        return;
      }
    }

    if (isFillGap && !form.correct_answer) {
      toast({ title: "Correct answer text is required for fill in the gap", variant: "destructive" });
      return;
    }

    if (isDragDrop) {
      if (!form.option_a || !form.option_b) {
        toast({ title: "At least 2 items are required for drag & drop", variant: "destructive" });
        return;
      }
      if (!form.correct_answer) {
        toast({ title: "Correct order is required (e.g. b,a,c,d)", variant: "destructive" });
        return;
      }
    }

    saveMutation.mutate({
      training_type: selectedType,
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
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      points: q.points,
      answer_count: q.answer_count || 4,
      question_type: q.question_type || "multiple_choice",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingQuestion(null);
    setForm(emptyQuestion);
    setDialogOpen(true);
  };

  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v };
    if (k === "answer_count") {
      const newOpts = OPTION_LETTERS.slice(0, Number(v));
      if (!newOpts.includes(f.correct_answer) && f.question_type === "multiple_choice") {
        next.correct_answer = "a";
      }
    }
    if (k === "question_type") {
      if (v === "fill_in_gap") {
        next.correct_answer = "";
        next.answer_count = 0;
      } else if (v === "drag_and_drop") {
        next.correct_answer = "";
        next.answer_count = f.answer_count || 4;
      } else {
        next.correct_answer = "a";
        next.answer_count = f.answer_count || 4;
      }
    }
    return next;
  });

  const questionTypeLabel = (type) => QUESTION_TYPES.find(t => t.value === type)?.label || type;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Exam Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage exam questions for training programmes</p>
        </div>
      </div>

      {/* Exam Titles Management */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Exam Titles
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
              setEditingTitle(null);
              setTitleForm({ name: "", description: "" });
              setTitleDialogOpen(true);
            }}>
              <Plus className="h-3.5 w-3.5" /> Add Title
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {titlesLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : examTitles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No exam titles yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {examTitles.map(t => (
                <div key={t.id} className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${
                  selectedType === t.name
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted"
                }`} onClick={() => setSelectedType(t.name)}>
                  <span className="font-medium">{t.name}</span>
                  {!t.is_active && <Badge variant="secondary" className="text-[9px] h-4">Inactive</Badge>}
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    onClick={(e) => { e.stopPropagation(); setEditingTitle(t); setTitleForm({ name: t.name, description: t.description || "" }); setTitleDialogOpen(true); }}
                  >
                    <Edit className="h-3 w-3" />
                  </button>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                    onClick={(e) => { e.stopPropagation(); setDeleteTitleTarget(t); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedType && (
        <>
          {/* Controls */}
          <div className="flex items-center justify-end">
            <Button size="sm" className="gap-1.5" onClick={openNew}>
              <Plus className="h-4 w-4" /> Add Question
            </Button>
          </div>

          {/* Pass Mark Configuration */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Pass Mark — {selectedType}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Pass Percentage (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={passMarkInput}
                    onChange={e => setPassMarkInput(e.target.value)}
                    className="w-28"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={savePassMarkMutation.isPending || passMarkInput === String(currentPassMark)}
                  onClick={() => savePassMarkMutation.mutate(passMarkInput)}
                >
                  {savePassMarkMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
                <span className="text-xs text-muted-foreground pb-2">
                  Global default: {globalThreshold}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Questions list */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">
                {selectedType} Questions ({questions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : questions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No questions yet. Add your first question above.</p>
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
                              <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                              {q.question_text}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <Badge variant="secondary" className="text-[10px]">{questionTypeLabel(qType)}</Badge>
                            </div>
                            {qType === "multiple_choice" && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {qOpts.map(opt => (
                                  q[`option_${opt}`] && (
                                    <div key={opt} className={`text-xs px-2 py-1.5 rounded ${
                                      q.correct_answer === opt
                                        ? "bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/30"
                                        : "bg-muted text-muted-foreground"
                                    }`}>
                                      <span className="font-bold uppercase mr-1">{opt}.</span>
                                      {q[`option_${opt}`]}
                                    </div>
                                  )
                                ))}
                              </div>
                            )}
                            {qType === "fill_in_gap" && (
                              <p className="text-xs text-emerald-600 mt-2">
                                Answer: <strong>{q.correct_answer}</strong>
                              </p>
                            )}
                            {qType === "drag_and_drop" && (
                              <div className="mt-2 space-y-1">
                                <div className="flex flex-wrap gap-1.5">
                                  {qOpts.map(opt => q[`option_${opt}`] && (
                                    <span key={opt} className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                                      {opt.toUpperCase()}. {q[`option_${opt}`]}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-xs text-emerald-600">
                                  Correct order: <strong>{q.correct_answer}</strong>
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="outline" className="text-[10px]">{q.points} pt{q.points !== 1 ? "s" : ""}</Badge>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(q)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Attempts */}
          {attempts.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Recent Exam Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead className="text-center">Score</TableHead>
                        <TableHead className="text-center">Result</TableHead>
                        <TableHead className="text-center">Certificate</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attempts.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm font-medium">
                            {a.members?.first_name} {a.members?.last_name}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {a.score}/{a.total_points}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={a.passed ? "default" : "destructive"} className="text-xs">
                              {a.passed ? "Passed" : "Failed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {a.certificate_issued ? "✅ Issued" : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "In Progress"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Delete Question Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Title Confirmation */}
      <AlertDialog open={!!deleteTitleTarget} onOpenChange={(open) => !open && setDeleteTitleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam Title</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteTitleTarget?.name}"? This will not remove existing questions or attempts, but they will no longer appear in the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTitleTarget && deleteTitleMutation.mutate(deleteTitleTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTitleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exam Title Dialog */}
      <Dialog open={titleDialogOpen} onOpenChange={setTitleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTitle ? "Edit Exam Title" : "Add Exam Title"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!titleForm.name.trim()) {
              toast({ title: "Title name is required", variant: "destructive" });
              return;
            }
            saveTitleMutation.mutate({
              name: titleForm.name.trim(),
              description: titleForm.description.trim() || null,
              is_active: true,
            });
          }} className="space-y-4">
            <div>
              <Label>Title Name *</Label>
              <Input value={titleForm.name} onChange={e => setTitleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BFC, Leadership 101" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={titleForm.description} onChange={e => setTitleForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
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

      {/* Add/Edit Question Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Question Type</Label>
              <Select value={form.question_type} onValueChange={v => set("question_type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Question *</Label>
              <Textarea value={form.question_text} onChange={e => set("question_text", e.target.value)} rows={3} placeholder={isFillGap ? "Use ___ to indicate the blank (e.g. 'The capital of France is ___')" : ""} />
            </div>

            {/* Multiple Choice fields */}
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
                      <Input
                        value={form[`option_${opt}`]}
                        onChange={e => set(`option_${opt}`, e.target.value)}
                        placeholder={`Option ${opt.toUpperCase()}`}
                      />
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

            {/* Fill in the Gap fields */}
            {isFillGap && (
              <div>
                <Label>Correct Answer *</Label>
                <Input
                  value={form.correct_answer}
                  onChange={e => set("correct_answer", e.target.value)}
                  placeholder="The expected answer text"
                />
                <p className="text-xs text-muted-foreground mt-1">Case-insensitive matching will be used.</p>
              </div>
            )}

            {/* Drag & Drop fields */}
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
                  <Label>Items (in display order) *</Label>
                  {activeOptions.map(opt => (
                    <div key={opt} className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-muted-foreground w-5">{opt}.</span>
                      <Input
                        value={form[`option_${opt}`]}
                        onChange={e => set(`option_${opt}`, e.target.value)}
                        placeholder={`Item ${opt.toUpperCase()}`}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <Label>Correct Order *</Label>
                  <Input
                    value={form.correct_answer}
                    onChange={e => set("correct_answer", e.target.value)}
                    placeholder={`e.g. ${activeOptions.reverse().join(",")}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Comma-separated letters in correct order (e.g. b,a,d,c)
                  </p>
                </div>
              </>
            )}

            <div>
              <Label>Points</Label>
              <Input type="number" min="1" value={form.points} onChange={e => set("points", e.target.value)} className="w-24" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingQuestion ? "Update" : "Add"} Question
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
