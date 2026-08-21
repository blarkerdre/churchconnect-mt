import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Trophy, Flame } from "lucide-react";

export default function QuizPlayer({ tenantId, quiz, player, onFinished, onClose }) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [startedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["trivia-quiz-questions", tenantId, quiz?.id],
    enabled: !!tenantId && !!quiz?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_trivia_quiz_safe", {
        _tenant_id: tenantId,
        _quiz_id: quiz.id,
      });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    setIndex(0);
    setAnswers({});
    setResult(null);
  }, [quiz?.id]);

  const current = questions[index];
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;

  const resultsById = useMemo(() => {
    const map = {};
    (result?.results || []).forEach((r) => { map[r.question_id] = r; });
    return map;
  }, [result]);

  const select = (optionIndex) => {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [current.question_id]: optionIndex }));
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const duration = Math.round((Date.now() - startedAt) / 1000);
      const { data, error } = await supabase.rpc("submit_trivia_attempt", {
        _tenant_id: tenantId,
        _quiz_id: quiz.id,
        _answers: answers,
        _duration_seconds: duration,
        _player_kind: player?.kind || "member",
        _child_id: player?.childId || null,
      });
      if (error) throw error;
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["trivia-my-attempts"] });
      queryClient.invalidateQueries({ queryKey: ["trivia-leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["trivia-my-streak"] });
      onFinished?.(data);
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("ALREADY_PLAYED")) toast.error("This quiz has already been played by this player today.");
      else if (msg.includes("NOT_GUARDIAN")) toast.error("You are not the registered guardian for this child.");
      else toast.error("Could not submit your answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading questions…
      </div>
    );
  }

  if (!total) {
    return <p className="py-8 text-center text-sm text-muted-foreground">This quiz has no questions yet.</p>;
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-primary" /> {result.correct_count} / {result.total_count} correct
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{result.score} points</Badge>
            {result.bonus > 0 && <Badge variant="outline">+{result.bonus} speed bonus</Badge>}
            <Badge variant="outline" className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5" /> {result.current_streak} day streak
            </Badge>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {questions.map((q) => {
            const r = resultsById[q.question_id] || {};
            const opts = Array.isArray(q.options) ? q.options : [];
            return (
              <Card key={q.question_id}>
                <CardContent className="pt-4 space-y-2">
                  <p className="text-sm whitespace-pre-line font-medium">{q.prompt}</p>
                  <div className="space-y-1">
                    {opts.map((opt, i) => {
                      const isCorrect = i === r.correct_index;
                      const isChosen = i === r.selected_index;
                      return (
                        <div
                          key={i}
                          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                            isCorrect
                              ? "border-primary bg-primary/10"
                              : isChosen
                              ? "border-destructive bg-destructive/10"
                              : "border-border"
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                          ) : isChosen ? (
                            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                          ) : (
                            <span className="h-4 w-4 shrink-0" />
                          )}
                          <span className="min-w-0 break-words">{opt}</span>
                        </div>
                      );
                    })}
                  </div>
                  {r.explanation && <p className="text-xs text-muted-foreground">{r.explanation}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    );
  }

  const opts = Array.isArray(current?.options) ? current.options : [];
  const chosen = answers[current?.question_id];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Question {index + 1} of {total}</span>
          <span>{answeredCount} answered</span>
        </div>
        <Progress value={((index + 1) / total) * 100} />
      </div>

      <Card>
        <CardContent className="pt-5 space-y-3">
          <p className="text-sm sm:text-base whitespace-pre-line font-medium">{current.prompt}</p>
          <div className="space-y-2">
            {opts.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => select(i)}
                className={`w-full text-left rounded-md border px-3 py-2.5 text-sm transition-colors ${
                  chosen === i ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                }`}
              >
                <span className="break-words">{opt}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" className="sm:w-auto w-full" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          Back
        </Button>
        {index < total - 1 ? (
          <Button className="flex-1" onClick={() => setIndex((i) => i + 1)}>Next</Button>
        ) : (
          <Button className="flex-1" onClick={submit} disabled={submitting || answeredCount === 0}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit answers
          </Button>
        )}
      </div>
    </div>
  );
}
