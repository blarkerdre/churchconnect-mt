import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CalendarCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";

export default function SelfCheckInWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  // Get the member record linked to this user
  const { data: myMember } = useQuery({
    queryKey: ["my-member", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get today's sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["today-sessions", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_sessions")
        .select("id, title, session_type, session_date")
        .eq("session_date", today)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  // Get my check-in records for today's sessions
  const sessionIds = sessions.map((s) => s.id);
  const { data: myRecords = [] } = useQuery({
    queryKey: ["my-checkins", sessionIds],
    queryFn: async () => {
      if (!myMember?.id || sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, session_id, checked_in_at")
        .eq("member_id", myMember.id)
        .in("session_id", sessionIds);
      if (error) throw error;
      return data;
    },
    enabled: !!myMember?.id && sessionIds.length > 0,
  });

  const checkedSessionIds = new Set(myRecords.map((r) => r.session_id));

  const checkInMutation = useMutation({
    mutationFn: async (sessionId) => {
      const { error } = await supabase.from("attendance_records").insert({
        session_id: sessionId,
        member_id: myMember.id,
        check_in_method: "self",
        checked_in_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-checkins"] });
      toast({ title: "Checked in!", description: "Your attendance has been recorded." });
    },
    onError: (err) => {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    },
  });

  if (!myMember || sessions.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-accent" />
          Today's Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessionsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          sessions.map((session) => {
            const isCheckedIn = checkedSessionIds.has(session.id);
            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isCheckedIn
                    ? "bg-chart-3/5 border-chart-3/20"
                    : "bg-muted/50 border-border"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {session.title || session.session_type}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {session.session_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{session.session_date}</span>
                  </div>
                </div>
                {isCheckedIn ? (
                  <div className="flex items-center gap-1.5 text-chart-3 shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-xs font-medium">Checked in</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => checkInMutation.mutate(session.id)}
                    disabled={checkInMutation.isPending}
                    className="shrink-0"
                  >
                    {checkInMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Check In
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
