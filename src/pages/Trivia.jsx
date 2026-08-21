import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, CalendarDays, Flame, Trophy, CheckCircle2 } from "lucide-react";
import QuizPlayer from "@/components/trivia/QuizPlayer";
import TriviaLeaderboard from "@/components/trivia/TriviaLeaderboard";
import TriviaAdminPanel from "@/components/trivia/TriviaAdminPanel";

export default function Trivia() {
  const { tenantId } = useTenantQuery();
  const { user, isAdmin, myMember } = useAuth();
  const queryClient = useQueryClient();
  const [playerValue, setPlayerValue] = useState("member");
  const [activeQuiz, setActiveQuiz] = useState(null);

  // Make sure today's daily quiz and this week's challenge exist.
  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    supabase.rpc("ensure_trivia_quizzes", { _tenant_id: tenantId }).then(() => {
      if (!cancelled) queryClient.invalidateQueries({ queryKey: ["trivia-quizzes", tenantId] });
    });
    return () => { cancelled = true; };
  }, [tenantId, queryClient]);

  const { data: quizzes = [] } = useQuery({
    queryKey: ["trivia-quizzes", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("trivia_quizzes")
        .select("*")
        .eq("tenant_id", tenantId)
        .lte("starts_on", today)
        .gte("ends_on", today)
        .order("kind");
      if (error) throw error;
      return data || [];
    },
  });

  const daily = quizzes.find((q) => q.kind === "daily");
  const weekly = quizzes.find((q) => q.kind === "weekly");

  // Children the signed-in member is guardian for
  const { data: children = [] } = useQuery({
    queryKey: ["trivia-my-children", tenantId, myMember?.id],
    enabled: !!tenantId && !!myMember?.id,
    queryFn: async () => {
      const [teens, preteens] = await Promise.all([
        supabase.from("teens").select("id, first_name, last_name")
          .eq("tenant_id", tenantId).eq("primary_guardian_member_id", myMember.id),
        supabase.from("preteens").select("id, first_name, last_name")
          .eq("tenant_id", tenantId).eq("primary_guardian_member_id", myMember.id),
      ]);
      return [
        ...(teens.data || []).map((t) => ({ ...t, kind: "teen" })),
        ...(preteens.data || []).map((p) => ({ ...p, kind: "preteen" })),
      ];
    },
  });

  const player = useMemo(() => {
    if (playerValue === "member") return { kind: "member", childId: null, key: `member:${user?.id}` };
    const [kind, id] = playerValue.split(":");
    return { kind, childId: id, key: `${kind}:${id}` };
  }, [playerValue, user?.id]);

  const quizIds = quizzes.map((q) => q.id);
  const { data: attempts = [] } = useQuery({
    queryKey: ["trivia-my-attempts", tenantId, quizIds.join(","), player.key],
    enabled: !!tenantId && quizIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trivia_attempts")
        .select("id, quiz_id, player_key, score, correct_count, total_count")
        .eq("tenant_id", tenantId)
        .in("quiz_id", quizIds);
      if (error) throw error;
      return data || [];
    },
  });

  const attemptFor = (quiz) =>
    attempts.find((a) => a.quiz_id === quiz?.id && a.player_key === player.key);

  const { data: streak } = useQuery({
    queryKey: ["trivia-my-streak", tenantId, player.key],
    enabled: !!tenantId && !!player.key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trivia_streaks")
        .select("current_streak, longest_streak, total_points")
        .eq("tenant_id", tenantId)
        .eq("player_key", player.key)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const QuizCard = ({ quiz, icon: Icon, label, blurb }) => {
    const attempt = attemptFor(quiz);
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" /> {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{blurb}</p>
          {!quiz ? (
            <p className="text-sm text-muted-foreground">Not available yet — an admin needs to add questions.</p>
          ) : attempt ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
              </Badge>
              <Badge variant="outline">{attempt.correct_count}/{attempt.total_count} correct</Badge>
              <Badge variant="outline">{attempt.score} pts</Badge>
            </div>
          ) : (
            <Button className="w-full sm:w-auto" onClick={() => setActiveQuiz(quiz)}>Play now</Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Bible Trivia</h1>
        <p className="text-sm text-muted-foreground">
          Daily and weekly scripture quizzes with points, streaks and a church leaderboard.
        </p>
      </div>

      <Tabs defaultValue="play">
        <TabsList className="w-full grid grid-cols-2 sm:w-auto sm:inline-grid sm:grid-cols-3">
          <TabsTrigger value="play">Play</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          {isAdmin && <TabsTrigger value="manage" className="col-span-2 sm:col-span-1">Manage</TabsTrigger>}
        </TabsList>

        <TabsContent value="play" className="mt-4 space-y-4">
          {children.length > 0 && (
            <Card>
              <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-sm font-medium">Playing as</span>
                <Select value={playerValue} onValueChange={setPlayerValue}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Me</SelectItem>
                    {children.map((c) => (
                      <SelectItem key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>
                        {c.first_name} {c.last_name} ({c.kind === "teen" ? "Teen" : "Preteen"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5" /> Streak</div>
                <p className="text-2xl font-bold">{streak?.current_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Best {streak?.longest_streak || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> Points</div>
                <p className="text-2xl font-bold">{streak?.total_points || 0}</p>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <QuizCard quiz={daily} icon={BookOpen} label="Today's quiz" blurb="Five quick questions — one attempt per day keeps your streak alive." />
            <QuizCard quiz={weekly} icon={CalendarDays} label="Weekly challenge" blurb="Fifteen questions, open all week. One attempt per player." />
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <TriviaLeaderboard tenantId={tenantId} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="manage" className="mt-4">
            <TriviaAdminPanel tenantId={tenantId} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={!!activeQuiz} onOpenChange={(o) => !o && setActiveQuiz(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeQuiz?.title || "Bible Trivia"}</DialogTitle>
          </DialogHeader>
          {activeQuiz && (
            <QuizPlayer
              tenantId={tenantId}
              quiz={activeQuiz}
              player={player}
              onClose={() => setActiveQuiz(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
