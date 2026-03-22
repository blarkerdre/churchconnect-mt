import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, XCircle, Award } from "lucide-react";
import { useAppSetting } from "@/hooks/useAppSetting";

const OPTION_LETTERS = ["a", "b", "c", "d"];

export default function TakeExamDialog({ open, onOpenChange, trainingType, memberId }) {
  const qc = useQueryClient();
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  // Global fallback
  const { data: globalPassMark } = useAppSetting("exam_pass_percentage", [70]);
  const globalThreshold = Array.isArray(globalPassMark) ? Number(globalPassMark[0]) || 70 : 70;

  // Per-type pass mark
  const { data: typePassMarkSetting } = useQuery({
    queryKey: ["app-setting", `exam_pass_mark_${trainingType}`],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", `exam_pass_mark_${trainingType}`)
        .maybeSingle();
      return data?.value;
    },
    enabled: open && !!trainingType,
  });

  const passThreshold = typePassMarkSetting != null ? Number(typePassMarkSetting) : globalThreshold;

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["exam-questions", trainingType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_questions")
        .select("*")
        .eq("training_type", trainingType)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: open && !!trainingType,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const totalPoints = questions.reduce((s, q) => s + q.points, 0);
      let score = 0;
      const answerRows = questions.map(q => {
        const selected = answers[q.id] || null;
        const isCorrect = selected === q.correct_answer;
        if (isCorrect) score += q.points;
        return { question_id: q.id, selected_answer: selected, is_correct: isCorrect };
      });

      const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
      const passed = percentage >= passThreshold;

      const { data: attempt, error: attemptErr } = await supabase
        .from("exam_attempts")
        .insert({
          member_id: memberId,
          training_type: trainingType,
          completed_at: new Date().toISOString(),
          score,
          total_points: totalPoints,
          passed,
        })
        .select("id")
        .single();
      if (attemptErr) throw attemptErr;

      const answersPayload = answerRows.map(a => ({ ...a, attempt_id: attempt.id }));
      const { error: ansErr } = await supabase.from("exam_answers").insert(answersPayload);
      if (ansErr) throw ansErr;

      if (passed) {
        try {
          const { data: certData, error: certErr } = await supabase.functions.invoke("issue-certificate", {
            body: { member_id: memberId, training_type: trainingType },
          });
          if (!certErr && certData?.success) {
            await supabase.from("exam_attempts").update({ certificate_issued: true }).eq("id", attempt.id);
          }
        } catch (e) {
          console.error("Certificate generation failed:", e);
        }
      }

      return { score, totalPoints, percentage, passed, answerRows };
    },
    onSuccess: (data) => {
      setResult(data);
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["exam-attempts"] });
      qc.invalidateQueries({ queryKey: ["my-certificates"] });
      qc.invalidateQueries({ queryKey: ["my-member-profile"] });
    },
    onError: (err) => toast({ title: "Error submitting exam", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    const unanswered = questions.filter(q => !answers[q.id]);
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
    onOpenChange(false);
  };

  const answeredCount = Object.keys(answers).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            {trainingType} Examination
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : questions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No exam questions available for {trainingType} yet.</p>
        ) : submitted && result ? (
          <div className="space-y-6 py-4">
            <div className={`text-center p-6 rounded-xl border-2 ${
              result.passed
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-destructive/30 bg-destructive/5"
            }`}>
              {result.passed ? (
                <Award className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
              ) : (
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
              )}
              <h3 className="text-lg font-display font-bold text-foreground">
                {result.passed ? "Congratulations! You Passed! 🎉" : "Not Quite There Yet"}
              </h3>
              <p className="text-2xl font-bold mt-2">
                {result.score}/{result.totalPoints}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({Math.round(result.percentage)}%)
                </span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">Pass mark: {passThreshold}%</p>
              {result.passed && (
                <p className="text-sm text-emerald-600 mt-2 font-medium">
                  Your certificate has been generated and will be emailed to you.
                </p>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Answer Review</h4>
              {questions.map((q, idx) => {
                const ansRow = result.answerRows.find(a => a.question_id === q.id);
                return (
                  <div key={q.id} className={`p-3 rounded-lg border ${ansRow?.is_correct ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
                    <p className="text-sm font-medium">
                      <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                      {q.question_text}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      {ansRow?.is_correct ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span>Your answer: <strong className="uppercase">{ansRow?.selected_answer || "—"}</strong></span>
                      {!ansRow?.is_correct && (
                        <span className="text-emerald-600">Correct: <strong className="uppercase">{q.correct_answer}</strong></span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button onClick={handleClose} className="w-full">Close</Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{answeredCount}/{questions.length} answered</span>
              <span>Pass mark: {passThreshold}%</span>
            </div>
            <Progress value={progress} className="h-2" />

            <div className="space-y-6">
              {questions.map((q, idx) => {
                const qOpts = OPTION_LETTERS.slice(0, q.answer_count || 4);
                return (
                  <div key={q.id} className="p-4 rounded-lg border border-border bg-card">
                    <p className="text-sm font-medium text-foreground mb-3">
                      <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                      {q.question_text}
                      <Badge variant="outline" className="ml-2 text-[10px]">{q.points} pt{q.points !== 1 ? "s" : ""}</Badge>
                    </p>
                    <RadioGroup
                      value={answers[q.id] || ""}
                      onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                      className="space-y-2"
                    >
                      {qOpts.map(opt => (
                        q[`option_${opt}`] && (
                          <div key={opt} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value={opt} id={`q-${q.id}-${opt}`} />
                            <Label htmlFor={`q-${q.id}-${opt}`} className="text-sm flex-1 cursor-pointer">
                              <span className="font-bold uppercase mr-1.5 text-muted-foreground">{opt}.</span>
                              {q[`option_${opt}`]}
                            </Label>
                          </div>
                        )
                      ))}
                    </RadioGroup>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button onClick={handleSubmit} disabled={submitMutation.isPending} className="w-full">
                {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Submit Exam
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
