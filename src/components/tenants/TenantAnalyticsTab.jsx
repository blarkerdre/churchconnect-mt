import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CalendarDays, MessageSquare, TrendingUp, Phone } from "lucide-react";

export default function TenantAnalyticsTab({ tenants }) {
  const { data: analytics = {}, isLoading } = useQuery({
    queryKey: ["tenant-analytics", tenants.map(t => t.id)],
    queryFn: async () => {
      const results = {};
      for (const t of tenants) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const [
          { count: memberCount },
          { count: userCount },
          { count: eventCount },
          { count: recentMembers },
          { count: attendanceSessions },
          { count: followupCount },
          { count: smsCount },
          { count: waCount },
        ] = await Promise.all([
          supabase.from("members").select("*", { count: "exact", head: true }).eq("tenant_id", t.id),
          supabase.from("tenant_memberships").select("*", { count: "exact", head: true }).eq("tenant_id", t.id),
          supabase.from("events").select("*", { count: "exact", head: true }).eq("tenant_id", t.id),
          supabase.from("members").select("*", { count: "exact", head: true }).eq("tenant_id", t.id).gte("created_at", thirtyDaysAgo),
          supabase.from("attendance_sessions").select("*", { count: "exact", head: true }).eq("tenant_id", t.id).gte("created_at", thirtyDaysAgo),
          supabase.from("followups").select("*", { count: "exact", head: true }).eq("tenant_id", t.id).eq("status", "Pending"),
          supabase.from("sms_log").select("*", { count: "exact", head: true }).eq("tenant_id", t.id).eq("channel", "sms").eq("status", "sent").gte("created_at", monthStart.toISOString()),
          supabase.from("sms_log").select("*", { count: "exact", head: true }).eq("tenant_id", t.id).eq("channel", "whatsapp").eq("status", "sent").gte("created_at", monthStart.toISOString()),
        ]);
        results[t.id] = {
          members: memberCount || 0,
          users: userCount || 0,
          events: eventCount || 0,
          recentMembers: recentMembers || 0,
          attendanceSessions: attendanceSessions || 0,
          pendingFollowups: followupCount || 0,
          smsSent: smsCount || 0,
          whatsappSent: waCount || 0,
        };
      }
      return results;
    },
    enabled: tenants.length > 0,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading analytics...</p>;

  return (
    <div className="space-y-4">
      {tenants.filter(t => !t.is_archived).map((t) => {
        const stats = analytics[t.id] || {};
        const memberUsage = t.member_limit > 0 ? Math.round((stats.members / t.member_limit) * 100) : 0;
        const smsUsage = t.sms_limit_monthly > 0 ? Math.round((stats.smsSent / t.sms_limit_monthly) * 100) : 0;
        const waUsage = t.whatsapp_limit_monthly > 0 ? Math.round((stats.whatsappSent / t.whatsapp_limit_monthly) * 100) : 0;
        return (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <Badge variant="outline" className="text-xs">{t.plan_tier || "free"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-semibold">{stats.members}</p>
                    <p className="text-[10px] text-muted-foreground">Members</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-semibold">{stats.events}</p>
                    <p className="text-[10px] text-muted-foreground">Events</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-semibold">{stats.recentMembers}</p>
                    <p className="text-[10px] text-muted-foreground">New (30d)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-lg font-semibold">{stats.pendingFollowups}</p>
                    <p className="text-[10px] text-muted-foreground">Pending F/U</p>
                  </div>
                </div>
              </div>

              {t.member_limit > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Member usage</span>
                    <span>{stats.members}/{t.member_limit}</span>
                  </div>
                  <Progress value={Math.min(memberUsage, 100)} className="h-2" />
                </div>
              )}

              {t.sms_limit_monthly > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>SMS usage (this month)</span>
                    <span>{stats.smsSent}/{t.sms_limit_monthly}</span>
                  </div>
                  <Progress value={Math.min(smsUsage, 100)} className="h-2" />
                </div>
              )}

              {t.whatsapp_limit_monthly > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>WhatsApp usage (this month)</span>
                    <span>{stats.whatsappSent}/{t.whatsapp_limit_monthly}</span>
                  </div>
                  <Progress value={Math.min(waUsage, 100)} className="h-2" />
                </div>
              )}

              <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                <span>{stats.users} users</span>
                <span>•</span>
                <span>{stats.attendanceSessions} sessions (30d)</span>
                <span>•</span>
                <span>{stats.smsSent} SMS / {stats.whatsappSent} WA (month)</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}