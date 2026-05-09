import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, CalendarCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/use-toast";

function parseUnits(churchUnit) {
  return (churchUnit || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
}

export default function SelfCheckInWidget() {
  const { user } = useAuth();
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [unitFilter, setUnitFilter] = useState("all");

  const { data: myMember } = useQuery({
    queryKey: ["my-member", user?.id, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select("id, first_name, last_name, church_unit, wsf_centre_id")
        .eq("user_id", user.id);
      if (tenantId) query = query.eq("tenant_id", tenantId);
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: myCentre } = useQuery({
    queryKey: ["my-centre", myMember?.wsf_centre_id],
    enabled: !!myMember?.wsf_centre_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wsf_centres")
        .select("id, name")
        .eq("id", myMember.wsf_centre_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const myUnits = useMemo(() => parseUnits(myMember?.church_unit), [myMember?.church_unit]);
  const myUnitsLower = useMemo(() => myUnits.map((u) => u.toLowerCase()), [myUnits]);
  const myCentreLower = (myCentre?.name || "").toLowerCase();

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["today-sessions", today, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("attendance_sessions")
          .select("id, title, session_type, session_date, unit")
          .eq("session_date", today)
          .order("created_at")
      );
      if (error) throw error;
      return data;
    },
  });

  // Eligibility: members can self check-in to:
  //  - General services (no `unit` set, e.g. Sunday Service / Special Service / Bible School / Other)
  //  - Unit Meetings for units they belong to
  //  - Home Cell Meetings for the centre they're assigned to
  const eligibleSessions = useMemo(() => {
    return sessions.filter((s) => {
      const unit = (s.unit || "").trim();
      if (s.session_type === "Unit Meeting") {
        return unit && myUnitsLower.includes(unit.toLowerCase());
      }
      if (s.session_type === "Home Cell Meeting") {
        return unit && myCentreLower && unit.toLowerCase() === myCentreLower;
      }
      // General sessions (no unit/centre scoping) — visible to all tenant members
      return !unit;
    });
  }, [sessions, myUnitsLower, myCentreLower]);

  const visibleSessions = useMemo(() => {
    if (unitFilter === "all") return eligibleSessions;
    return eligibleSessions.filter(
      (s) => (s.unit || "").toLowerCase() === unitFilter.toLowerCase()
    );
  }, [eligibleSessions, unitFilter]);

  const sessionIds = visibleSessions.map((s) => s.id);
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
      const { error } = await supabase.from("attendance_records").insert(withTenant({
        session_id: sessionId,
        member_id: myMember.id,
        check_in_method: "self",
        checked_in_at: new Date().toISOString(),
      }));
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

  if (!myMember) return null;

  // Build filter options from units/centres present in the eligible sessions
  const unitOptions = Array.from(
    new Set(
      eligibleSessions
        .filter((s) => (s.session_type === "Unit Meeting" || s.session_type === "Home Cell Meeting") && s.unit)
        .map((s) => s.unit)
    )
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-accent" />
          Today's Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {unitOptions.length > 1 && (
          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Filter by unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All my meetings</SelectItem>
              {unitOptions.map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {sessionsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : visibleSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            {eligibleSessions.length === 0 ? "No meetings open for check-in today." : "No meetings match this filter."}
          </p>
        ) : (
          visibleSessions.map((session) => {
            const isCheckedIn = checkedSessionIds.has(session.id);
            return (
              <div
                key={session.id}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isCheckedIn ? "bg-chart-3/5 border-chart-3/20" : "bg-muted/50 border-border"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {session.title || session.session_type}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {session.session_type}
                    </Badge>
                    {session.unit && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {session.unit}
                      </Badge>
                    )}
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
