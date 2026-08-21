import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Flame } from "lucide-react";

export default function TriviaWidget() {
  const { tenantId, tenantSlug, currentTenant } = useTenant();
  const { user } = useAuth();
  const prefix = tenantSlug ? `/t/${tenantSlug}` : "";
  const disabled = (currentTenant?.settings?.disabled_features || []).includes("/trivia");

  const { data } = useQuery({
    queryKey: ["trivia-widget", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id && !disabled,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: quiz } = await supabase
        .from("trivia_quizzes")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", "daily")
        .eq("starts_on", today)
        .maybeSingle();
      const [attempt, streak] = await Promise.all([
        quiz
          ? supabase.from("trivia_attempts").select("id")
              .eq("quiz_id", quiz.id).eq("player_key", `member:${user.id}`).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("trivia_streaks").select("current_streak")
          .eq("tenant_id", tenantId).eq("player_key", `member:${user.id}`).maybeSingle(),
      ]);
      return { hasQuiz: !!quiz, played: !!attempt.data, streak: streak.data?.current_streak || 0 };
    },
  });

  if (disabled || !data?.hasQuiz) return null;

  return (
    <Card>
      <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Today's Bible Trivia</span>
            {data.streak > 0 && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Flame className="h-3 w-3" /> {data.streak}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {data.played ? "You've played today — come back tomorrow to keep your streak." : "Five quick questions to keep your streak going."}
          </p>
        </div>
        <Button asChild size="sm" variant={data.played ? "outline" : "default"} className="w-full sm:w-auto">
          <Link to={`${prefix}/trivia`}>{data.played ? "View leaderboard" : "Play now"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
