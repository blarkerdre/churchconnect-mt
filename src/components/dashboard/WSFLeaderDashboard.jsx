import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, CalendarDays, FileText, Loader2, ChevronRight, Star, Cake } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { format, subWeeks, startOfWeek } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import SelfCheckInWidget from "@/components/attendance/SelfCheckInWidget";
import MemberFeed from "@/components/profile/MemberFeed";
import { UpcomingBirthdayItem } from "@/components/dashboard/BirthdayCelebration";
import DashboardBanner from "@/components/dashboard/DashboardBanner";
import AppFeedbackDialog from "@/components/feedback/AppFeedbackDialog";

export default function WSFLeaderDashboard() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { user, myMember, profile } = useAuth();
  const { currentTenant, tenantRole } = useTenant();
  const { tenantId, scopeQuery } = useTenantQuery();
  const roleLabel = tenantRole ? tenantRole.charAt(0).toUpperCase() + tenantRole.slice(1) : "";

  // Get centres this user leads
  const { data: ledCentres = [], isLoading: centresLoading } = useQuery({
    queryKey: ["wsf-led-centres", myMember?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("wsf_centres")
          .select("*")
          .eq("leader_id", myMember.id)
      );
      if (error) throw error;
      return data;
    },
    enabled: !!myMember?.id,
  });

  const centreIds = ledCentres.map(c => c.id);

  // Get members in these centres
  const { data: centreMembers = [] } = useQuery({
    queryKey: ["wsf-leader-members", centreIds, tenantId],
    queryFn: async () => {
      if (!centreIds.length) return [];
      const { data, error } = await scopeQuery(
        supabase
          .from("members")
          .select("id, first_name, last_name, membership_status, created_at, wsf_centre_id, date_of_birth, photo_url, church_unit")
          .in("wsf_centre_id", centreIds)
          .order("first_name")
      );
      if (error) throw error;
      return data;
    },
    enabled: centreIds.length > 0,
  });

  // Get recent attendance reports for these centres
  const { data: recentReports = [] } = useQuery({
    queryKey: ["wsf-leader-reports", centreIds, tenantId],
    queryFn: async () => {
      if (!centreIds.length) return [];
      const { data, error } = await scopeQuery(
        supabase
          .from("wsf_attendance_reports")
          .select("*, wsf_centres(name)")
          .in("centre_id", centreIds)
          .order("meeting_date", { ascending: false })
          .limit(12)
      );
      if (error) throw error;
      return data;
    },
    enabled: centreIds.length > 0,
  });

  if (centresLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (ledCentres.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          You are not assigned as a leader to any Home Cell centre yet.
        </CardContent>
      </Card>
    );
  }

  const totalMembers = centreMembers.length;
  const activeMembers = centreMembers.filter(m => m.membership_status === "Active").length;
  const totalReports = recentReports.length;

  // Compute average attendance from recent reports
  const avgAttendance = totalReports > 0
    ? Math.round(recentReports.reduce((sum, r) => sum + r.male + r.female + r.children, 0) / totalReports)
    : 0;

  // Chart data — last reports reversed for chronological order
  const chartData = [...recentReports].reverse().map(r => ({
    date: format(new Date(r.meeting_date), "dd MMM"),
    total: r.male + r.female + r.children,
    adults: r.male + r.female,
    children: r.children,
    firstTimers: r.first_timers,
  }));


  // Compute upcoming birthdays (next 7 days) from centre members
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    return centreMembers.filter(m => {
      if (!m.date_of_birth) return false;
      const dob = new Date(m.date_of_birth);
      for (let i = 0; i <= 7; i++) {
        const check = new Date(today);
        check.setDate(check.getDate() + i);
        if (dob.getMonth() === check.getMonth() && dob.getDate() === check.getDate()) return true;
      }
      return false;
    }).sort((a, b) => {
      const todayY = new Date().getFullYear();
      const getNext = (d) => { const x = new Date(d); x.setFullYear(todayY); if (x < new Date()) x.setFullYear(todayY + 1); return x; };
      return getNext(a.date_of_birth) - getNext(b.date_of_birth);
    });
  }, [centreMembers]);

  return (
    <div className="space-y-6">
      {/* Sliding Banner */}
      <DashboardBanner />

      {/* Welcome Banner */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-primary to-primary/70 text-primary-foreground overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center text-xl font-bold text-accent-foreground shrink-0">
            {myMember ? `${myMember.first_name?.[0]}${myMember.last_name?.[0]}` : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight">
              Welcome, {myMember?.first_name || profile?.full_name || "Leader"}!
            </h2>
            <p className="text-primary-foreground/60 text-sm mt-0.5 flex items-center gap-1.5">
              {currentTenant?.name || "Home Cell Leader Dashboard"}
              {roleLabel && <Badge className="bg-primary-foreground/20 text-primary-foreground text-[10px] border-0 py-0 px-1.5">{roleLabel}</Badge>}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-accent/30 text-accent text-xs border-0">Home Cell Leader</Badge>
              {ledCentres.map(c => (
                <Badge key={c.id} className="bg-primary-foreground/20 text-primary-foreground/90 text-xs border-0">
                  {c.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Self Check-In */}
      <SelfCheckInWidget />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { title: "Centre Members", value: totalMembers, sub: `${activeMembers} active`, icon: Users, color: "text-primary" },
          { title: "Avg Attendance", value: avgAttendance, sub: `From ${totalReports} reports`, icon: TrendingUp, color: "text-accent" },
          { title: "Centres", value: ledCentres.length, sub: ledCentres.map(c => c.name).join(", "), icon: CalendarDays, color: "text-chart-3" },
          { title: "Reports Filed", value: totalReports, sub: recentReports[0] ? `Last: ${format(new Date(recentReports[0].meeting_date), "dd MMM")}` : "None yet", icon: FileText, color: "text-chart-5" },
        ].map(stat => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{stat.title}</p>
                  <p className="text-2xl font-display font-bold text-foreground mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{stat.sub}</p>
                </div>
                <div className={`h-9 w-9 rounded-xl bg-muted flex items-center justify-center ${stat.color} shrink-0`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming Birthdays */}
      {upcomingBirthdays.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Cake className="h-4 w-4 text-accent" />
              Upcoming Birthdays
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {upcomingBirthdays.map(m => (
              <UpcomingBirthdayItem key={m.id} member={m} />
            ))}
          </CardContent>
        </Card>
      )}


      {/* Attendance Trends Chart */}
      {chartData.length > 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              Attendance Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                  <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="adults" name="Adults" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="children" name="Children" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="firstTimers" name="First Timers" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Recent Reports */}
      {recentReports.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentReports.slice(0, 5).map(r => {
              const total = r.male + r.female + r.children;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(r.meeting_date), "dd MMM yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.wsf_centres?.name} · M:{r.male} F:{r.female} C:{r.children}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.first_timers > 0 && (
                      <Badge className="bg-chart-3/10 text-chart-3 border-0 text-xs">
                        +{r.first_timers} new
                      </Badge>
                    )}
                    <Badge className="bg-primary/10 text-primary border-0 font-mono">{total}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Rate This App */}
      <Card
        className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setFeedbackOpen(true)}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Star className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Rate This App</p>
            <p className="text-xs text-muted-foreground">Share your feedback</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>

      {/* Announcements & Events Feed */}
      <MemberFeed member={myMember} />

      <AppFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
