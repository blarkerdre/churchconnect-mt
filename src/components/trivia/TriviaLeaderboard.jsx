import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Flame, Trophy } from "lucide-react";

function Board({ tenantId, scope, audience }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["trivia-leaderboard", tenantId, scope, audience],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_trivia_leaderboard", {
        _tenant_id: tenantId,
        _scope: scope,
        _audience: audience,
        _limit: 20,
      });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>;
  if (!data.length) return <p className="py-6 text-center text-sm text-muted-foreground">No scores yet — be the first to play.</p>;

  return (
    <ol className="divide-y">
      {data.map((row, i) => (
        <li key={row.player_key} className="flex items-center gap-3 py-2.5">
          <span className={`w-6 text-center text-sm font-semibold ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
            {i + 1}
          </span>
          <span className="flex-1 min-w-0 truncate text-sm">{row.display_name || "Player"}</span>
          {row.current_streak > 0 && (
            <Badge variant="outline" className="hidden sm:flex items-center gap-1 text-xs">
              <Flame className="h-3 w-3" /> {row.current_streak}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs whitespace-nowrap">{row.points} pts</Badge>
        </li>
      ))}
    </ol>
  );
}

export default function TriviaLeaderboard({ tenantId }) {
  const [audience, setAudience] = useState("adult");
  const [scope, setScope] = useState("all");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-primary" /> Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={audience} onValueChange={setAudience}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="adult">Adults</TabsTrigger>
            <TabsTrigger value="youth">Youth</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={scope} onValueChange={setScope}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All time</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
          </TabsList>
          <TabsContent value={scope} className="mt-2">
            <Board tenantId={tenantId} scope={scope} audience={audience} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
