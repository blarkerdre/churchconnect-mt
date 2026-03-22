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
import { Loader2, Plus, Trash2, Edit, BookOpen, Save } from "lucide-react";
import { useAppSetting } from "@/hooks/useAppSetting";

const EXAM_TRAINING_TYPES = ["BFC", "BCC", "LCC", "LDC"];
const OPTION_LETTERS = ["a", "b", "c", "d"];

const emptyQuestion = {
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_answer: "a",
  points: 1,
  answer_count: 4,
};

export default function ExamManagement() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState(EXAM_TRAINING_TYPES[0]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [form, setForm] = useState(emptyQuestion);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
  });

  const currentPassMark = typePassMarkSetting != null ? Number(typePassMarkSetting) : globalThreshold;
  const [passMarkInput, setPassMarkInput] = useState("");

  // Sync passMarkInput when data loads or type changes
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.question_text || !form.option_a || !form.option_b) {
      toast({ title: "Question and at least options A & B are required", variant: "destructive" });
      return;
    }
    // Validate correct_answer is within answer_count range
    if (!activeOptions.includes(form.correct_answer)) {
      toast({ title: `Correct answer must be one of: ${activeOptions.map(o => o.toUpperCase()).join(", ")}`, variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      training_type: selectedType,
      question_text: form.question_text,
      option_a: form.option_a,
      option_b: form.option_b,
      option_c: form.answer_count >= 3 ? form.option_c : "",
      option_d: form.answer_count >= 4 ? form.option_d : "",
      correct_answer: form.correct_answer,
      points: parseInt(form.points) || 1,
      answer_count: form.answer_count,
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
    // If reducing answer_count, reset correct_answer if it's out of range
    if (k === "answer_count") {
      const newOpts = OPTION_LETTERS.slice(0, Number(v));
      if (!newOpts.includes(f.correct_answer)) {
        next.correct_answer = "a";
      }
    }
    return next;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Exam Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage exam questions for training programmes</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXAM_TRAINING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" /> Add Question
          </Button>
        </div>
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
                const qOpts = OPTION_LETTERS.slice(0, q.answer_count || 4);
                return (
                  <div key={q.id} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                          {q.question_text}
                        </p>
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
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className="text-[10px]">{q.points} pt{q.points !== 1 ? "s" : ""}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{q.answer_count || 4} opts</Badge>
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

      {/* Delete Confirmation */}
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

      {/* Add/Edit Question Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Edit Question" : "Add Question"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Question *</Label>
              <Textarea value={form.question_text} onChange={e => set("question_text", e.target.value)} rows={3} />
            </div>
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
