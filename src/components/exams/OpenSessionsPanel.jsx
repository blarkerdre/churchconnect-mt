import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GraduationCap, CalendarDays } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { logAudit } from "@/lib/audit";

/**
 * Shows active Certificate Course sessions in the tenant and lets a member
 * register (or re-register if allowed) for all included courses with one click.
 */
export default function OpenSessionsPanel({ memberId }) {
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const qc = useQueryClient();

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["open-exam-sessions", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("exam_sessions").select("*").eq("status", "active").order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const sessionIds = sessions.map(s => s.id);

  const { data: sessionCourses = [] } = useQuery({
    queryKey: ["open-session-courses", tenantId, sessionIds.join("|")],
    queryFn: async () => {
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("exam_session_courses")
        .select("*")
        .eq("tenant_id", tenantId)
        .in("session_id", sessionIds)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && sessionIds.length > 0,
  });

  const courseTitles = Array.from(new Set(sessionCourses.map(c => c.exam_title)));

  const { data: titleRows = [], isLoading: titlesLoading } = useQuery({
    queryKey: ["exam-titles-by-name", tenantId, courseTitles.join("|")],
    queryFn: async () => {
      if (courseTitles.length === 0) return [];
      const { data, error } = await scopeQuery(
        supabase.from("exam_titles").select("id, name").in("name", courseTitles)
      );
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && courseTitles.length > 0,
  });

  const titleByName = useMemo(() => {
    const m = {};
    titleRows.forEach(r => { m[r.name] = r.id; });
    return m;
  }, [titleRows]);

  const { data: myRegs = [] } = useQuery({
    queryKey: ["my-session-regs", memberId, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_registrations")
        .select("course_id, session_id")
        .eq("member_id", memberId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data;
    },
    enabled: !!memberId && !!tenantId,
  });

  const registerMutation = useMutation({
    mutationFn: async (session) => {
      const courseTitlesForSession = sessionCourses.filter(c => c.session_id === session.id).map(c => c.exam_title);
      const courseIds = courseTitlesForSession.map(n => titleByName[n]).filter(Boolean);
      if (courseIds.length === 0) throw new Error("No courses available to register");
      const existingForSession = new Set(myRegs.filter(r => r.session_id === session.id).map(r => r.course_id));
      const rows = courseIds
        .filter(cid => !existingForSession.has(cid))
        .map(cid => withTenant({ member_id: memberId, course_id: cid, session_id: session.id }));
      if (rows.length === 0) return { inserted: 0 };
      const { error } = await supabase.from("course_registrations").insert(rows);
      if (error) throw error;
      return { inserted: rows.length, sessionId: session.id };
    },
    onSuccess: ({ inserted, sessionId }) => {
      qc.invalidateQueries({ queryKey: ["my-session-regs", memberId, tenantId] });
      qc.invalidateQueries({ queryKey: ["my-course-registrations"] });
      toast({ title: "Registered", description: `Enrolled in ${inserted} course(s).` });
      if (sessionId) {
        logAudit("session_self_register", "exam_session", sessionId, { member_id: memberId, inserted }, tenantId);
      }
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading || sessions.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" /> Open Certificate Course Sessions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sessions.map(s => {
          const courses = sessionCourses.filter(c => c.session_id === s.id);
          const myInSession = myRegs.filter(r => r.session_id === s.id);
          const courseIdsInSession = courses.map(c => titleByName[c.exam_title]).filter(Boolean);
          const fullyRegistered = courseIdsInSession.length > 0 && courseIdsInSession.every(cid => myInSession.some(r => r.course_id === cid));
          const partiallyRegistered = myInSession.length > 0 && !fullyRegistered;
          const tookBefore = courseIdsInSession.some(cid => myRegs.some(r => r.course_id === cid && r.session_id !== s.id));

          return (
            <div key={s.id} className="p-3 rounded-lg border border-border bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{s.name}</h3>
                    <Badge variant="outline" className="text-[10px]">Pass: {s.pass_mark_percentage}%</Badge>
                    {fullyRegistered && <Badge className="text-[10px] bg-chart-3/10 text-chart-3 border-0">Registered</Badge>}
                  </div>
                  {s.description && <p className="text-xs text-muted-foreground mt-1">{s.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {courses.map(c => (
                      <Badge key={c.id} variant="secondary" className="text-[10px]">{c.exam_title}</Badge>
                    ))}
                  </div>
                  {(s.starts_on || s.ends_on) && (
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {s.starts_on ? new Date(s.starts_on).toLocaleDateString() : "?"} – {s.ends_on ? new Date(s.ends_on).toLocaleDateString() : "?"}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {fullyRegistered ? (
                    <Badge variant="outline" className="text-[10px]">Take exams below</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => registerMutation.mutate(s)}
                      disabled={registerMutation.isPending || (tookBefore && s.allow_reregistration === false)}
                    >
                      {registerMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      {partiallyRegistered ? "Complete registration" : tookBefore ? "Register again" : "Register"}
                    </Button>
                  )}
                </div>
              </div>
              {tookBefore && s.allow_reregistration === false && !fullyRegistered && (
                <p className="text-[11px] text-muted-foreground mt-2">Re-registration is disabled for this session.</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
