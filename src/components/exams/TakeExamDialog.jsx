import React, { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, XCircle, Award, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const OPTION_LETTERS = ["a", "b", "c", "d"];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TakeExamDialog({ open, onOpenChange, trainingType, memberId, subjectId, subjectName, previewMode = false }) {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);
  const autoSubmitRef = useRef(false);

  // Get subject details for pass mark, time limit, randomize
  const { data: subjectData } = useQuery({
    queryKey: ["exam-subject-detail", subjectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("exam_subjects")
        .select("pass_mark_percentage, time_limit_minutes, randomize_questions")
        .eq("id", subjectId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!subjectId,
  });

  // Get course pass mark from exam_titles (fallback for legacy)
  const { data: courseData } = useQuery({
    queryKey: ["exam-title-detail", trainingType],
    queryFn: async () => {
      const { data } = await supabase
        .from("exam_titles")
        .select("pass_mark_percentage")
        .eq("name", trainingType)
        .maybeSingle();
      return data;
    },
    enabled: open && !!trainingType && !subjectId,
  });

  const passThreshold = subjectId
    ? (subjectData?.pass_mark_percentage ?? 50)
    : (courseData?.pass_mark_percentage ?? 50);

  const timeLimitMinutes = subjectData?.time_limit_minutes ?? null;
  const shouldRandomize = subjectData?.randomize_questions ?? false;

  // Fetch questions via safe RPC (no correct_answer exposed)
  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["exam-questions-take", subjectId, trainingType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_exam_questions_safe", {
        _subject_id: subjectId || null,
        _training_type: subjectId ? null : trainingType,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!(subjectId || trainingType),
  });

  // Shuffle questions when loaded
  useEffect(() => {
    if (questions.length > 0 && !submitted) {
      setShuffledQuestions(shouldRandomize ? shuffleArray(questions) : questions);
    }
  }, [questions, shouldRandomize, submitted]);

  // Timer
  useEffect(() => {
    if (!open || submitted || !timeLimitMinutes || questions.length === 0) return;
    setTimeLeft(timeLimitMinutes * 60);
    autoSubmitRef.current = false;
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open, submitted, timeLimitMinutes, questions.length]);

  useEffect(() => {
    if (timeLeft === null || submitted) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          autoSubmitRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timeLeft !== null, submitted]);

  // Auto-submit on timer expiry
  const doSubmit = useCallback(() => {
    if (!submitted && shuffledQuestions.length > 0 && !previewMode) {
      submitMutation.mutate();
    }
  }, [submitted, shuffledQuestions, previewMode]);

  useEffect(() => {
    if (autoSubmitRef.current && timeLeft === 0 && !submitted) {
      autoSubmitRef.current = false;
      if (previewMode) {
        toast({ title: "⏰ Time's up! (Preview mode — no auto-submit)" });
      } else {
        toast({ title: "⏰ Time's up! Auto-submitting your exam." });
        doSubmit();
      }
    }
  }, [timeLeft, submitted, doSubmit, previewMode]);

  // Submit via edge function (server-side grading)
  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("grade-exam", {
        body: {
          member_id: memberId,
          subject_id: subjectId || null,
          training_type: trainingType,
          answers,
          tenant_id: tenantId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
      if (timerRef.current) clearInterval(timerRef.current);
      qc.invalidateQueries({ queryKey: ["exam-attempts"] });
      qc.invalidateQueries({ queryKey: ["course-attempts"] });
      qc.invalidateQueries({ queryKey: ["my-course-attempts"] });
      qc.invalidateQueries({ queryKey: ["my-certificates"] });
      qc.invalidateQueries({ queryKey: ["my-member-profile"] });
    },
    onError: (err) => toast({ title: "Error submitting exam", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    const unanswered = shuffledQuestions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      toast({ title: `Please answer all questions (${unanswered.length} remaining)`, variant: "destructive" });
      return;
    }
    submitMutation.mutate();
  };

  const handleClose = () => {
    setAnswers({});
    setSubmitted(false);
    setResult(null);
    setTimeLeft(null);
    setShuffledQuestions([]);
    if (timerRef.current) clearInterval(timerRef.current);
    onOpenChange(false);
  };

  const answeredCount = Object.keys(answers).length;
  const progress = shuffledQuestions.length > 0 ? (answeredCount / shuffledQuestions.length) * 100 : 0;

  const moveItem = (questionId, items, fromIdx, direction) => {
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= items.length) return;
    const newItems = [...items];
    [newItems[fromIdx], newItems[toIdx]] = [newItems[toIdx], newItems[fromIdx]];
    setAnswers(prev => ({ ...prev, [questionId]: newItems.join(",") }));
  };

  const getOrderItems = (questionId, question) => {
    const current = answers[questionId];
    const qOpts = OPTION_LETTERS.slice(0, question.answer_count || 4);
    if (current) return current.split(",");
    return qOpts;
  };

  const title = subjectName ? `${trainingType} — ${subjectName}` : `${trainingType} Examination`;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const isWarning = timeLeft !== null && timeLeft <= 120;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <DialogTitle className="font-display flex items-center gap-2">{title}</DialogTitle>
            {timeLeft !== null && !submitted && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono font-bold ${
                isWarning ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-foreground"
              }`}>
                <Clock className="h-4 w-4" />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>
        </DialogHeader>

        {previewMode && (
          <div className="px-4 py-2.5 rounded-lg bg-accent/10 border border-accent/30 text-accent-foreground text-sm font-medium flex items-center gap-2">
            👁️ Preview Mode — This is how members will see the exam
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : shuffledQuestions.length === 0 && !submitted ? (
          <p className="text-sm text-muted-foreground text-center py-8">No exam questions available yet.</p>
        ) : submitted && result ? (
          <ExamResult result={result} questions={shuffledQuestions} onClose={handleClose} />
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{answeredCount}/{shuffledQuestions.length} answered</span>
              <span>Pass mark: {passThreshold}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="space-y-6">
              {shuffledQuestions.map((q, idx) => {
                const qType = q.question_type || "multiple_choice";
                return (
                  <div key={q.id} className="p-4 rounded-lg border border-border bg-card">
                    <p className="text-sm font-medium text-foreground mb-3">
                      <span className="text-muted-foreground mr-2">{idx + 1}.</span>{q.question_text}
                      <Badge variant="outline" className="ml-2 text-[10px]">{q.points} pt{q.points !== 1 ? "s" : ""}</Badge>
                    </p>
                    {qType === "multiple_choice" && <MCQInput question={q} value={answers[q.id] || ""} onChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))} />}
                    {qType === "fill_in_gap" && <Input placeholder="Type your answer..." value={answers[q.id] || ""} onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} className="max-w-md" />}
                    {qType === "drag_and_drop" && <DragDropInput question={q} items={getOrderItems(q.id, q)} onMove={(fromIdx, dir) => moveItem(q.id, getOrderItems(q.id, q), fromIdx, dir)} onInit={() => { if (!answers[q.id]) { const qOpts = OPTION_LETTERS.slice(0, q.answer_count || 4); setAnswers(prev => ({ ...prev, [q.id]: qOpts.join(",") })); } }} />}
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              {previewMode ? (
                <Button onClick={handleClose} variant="outline" className="w-full">
                  Close Preview
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="w-full">
                  {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Submit Exam
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MCQInput({ question, value, onChange }) {
  const qOpts = OPTION_LETTERS.slice(0, question.answer_count || 4);
  return (
    <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
      {qOpts.map(opt => question[`option_${opt}`] && (
        <div key={opt} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
          <RadioGroupItem value={opt} id={`q-${question.id}-${opt}`} />
          <Label htmlFor={`q-${question.id}-${opt}`} className="text-sm flex-1 cursor-pointer">
            <span className="font-bold uppercase mr-1.5 text-muted-foreground">{opt}.</span>{question[`option_${opt}`]}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

function DragDropInput({ question, items, onMove, onInit }) {
  React.useEffect(() => { onInit(); }, []);
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-2">Arrange items in the correct order:</p>
      {items.map((letter, idx) => (
        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background">
          <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}.</span>
          <span className="text-sm flex-1">{question[`option_${letter}`] || letter}</span>
          <div className="flex flex-col gap-0.5">
            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" disabled={idx === 0} onClick={() => onMove(idx, -1)}><ArrowUp className="h-3 w-3" /></Button>
            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" disabled={idx === items.length - 1} onClick={() => onMove(idx, 1)}><ArrowDown className="h-3 w-3" /></Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExamResult({ result, questions, onClose }) {
  const correctAnswers = result.correctAnswers || {};
  return (
    <div className="space-y-6 py-4">
      <div className={`text-center p-6 rounded-xl border-2 ${result.passed ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
        {result.passed ? <Award className="h-12 w-12 text-emerald-500 mx-auto mb-3" /> : <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />}
        <h3 className="text-lg font-display font-bold text-foreground">{result.passed ? "Congratulations! You Passed! 🎉" : "Not Quite There Yet"}</h3>
        <p className="text-2xl font-bold mt-2">{result.score}/{result.totalPoints}<span className="text-sm font-normal text-muted-foreground ml-2">({Math.round(result.percentage)}%)</span></p>
        <p className="text-sm text-muted-foreground mt-1">Pass mark: {result.passThreshold}%</p>
      </div>
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Answer Review</h4>
        {questions.map((q, idx) => {
          const ansRow = result.answerRows.find(a => a.question_id === q.id);
          const correctAnswer = correctAnswers[q.id];
          return (
            <div key={q.id} className={`p-3 rounded-lg border ${ansRow?.is_correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
              <p className="text-sm font-medium"><span className="text-muted-foreground mr-1">{idx + 1}.</span>{q.question_text}</p>
              <div className="flex items-center gap-2 mt-1 text-xs">
                {ansRow?.is_correct ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                <span>Your answer: <strong>{ansRow?.selected_answer || "—"}</strong></span>
                {!ansRow?.is_correct && correctAnswer && <span className="text-emerald-600">Correct: <strong>{correctAnswer}</strong></span>}
              </div>
            </div>
          );
        })}
      </div>
      <Button onClick={onClose} className="w-full">Close</Button>
    </div>
  );
}
