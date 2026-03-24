import React from "react";
import { Users, CalendarDays, HeartHandshake, Heart, TrendingUp, UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import SelfCheckInWidget from "@/components/attendance/SelfCheckInWidget";
import ProfileCompletionBanner from "@/components/profile/ProfileCompletionBanner";
import MemberDashboard from "@/components/dashboard/MemberDashboard";
import WSFLeaderDashboard from "@/components/dashboard/WSFLeaderDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useSubFeature } from "@/hooks/useSubFeature";

export default function Dashboard() {
  const { isAdmin, isUnitLeader, isWSFLeader, profile, myMember, loading: authLoading } = useAuth();

  // Only admins see the admin dashboard
  // Show WSF Leader dashboard for WSF leaders who aren't admin
  if (!authLoading && !isAdmin && isWSFLeader) {
    return <WSFLeaderDashboard />;
  }

  // Show member dashboard for unit leaders and regular members
  if (!authLoading && !isAdmin) {
    return <MemberDashboard currentUser={profile} myMember={myMember} />;
  }

  // Admin dashboard below
  const isLeaderOrAdmin = isAdmin;
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["dashboard-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, membership_status, water_baptism, holy_spirit_baptism, bfc_completed, winners_satellite, created_at");
      if (error) throw error;
      return data;
    },
    enabled: isLeaderOrAdmin,
  });

  const { data: events = [] } = useQuery({
    queryKey: ["dashboard-events"],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase.from("events").select("id, title, event_date").gte("event_date", today).order("event_date").limit(5);
      if (error) throw error;
      return data;
    },
    enabled: isLeaderOrAdmin,
  });

  const { data: pastoralCases = [] } = useQuery({
    queryKey: ["dashboard-pastoral"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pastoral_care").select("id, status").in("status", ["Open", "In Progress"]);
      if (error) throw error;
      return data;
    },
    enabled: isLeaderOrAdmin,
  });

  const { data: recentMembers = [] } = useQuery({
    queryKey: ["dashboard-recent-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, first_name, last_name, membership_status, created_at").order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
    enabled: isLeaderOrAdmin,
  });

  const { data: recentFollowups = [] } = useQuery({
    queryKey: ["dashboard-recent-followups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("followups").select("id, description, followup_type, status, created_at").order("created_at", { ascending: false }).limit(3);
      if (error) throw error;
      return data;
    },
    enabled: isLeaderOrAdmin,
  });

  const total = members.length;
  const firstTimers = members.filter(m => m.membership_status === "First Timer").length;
  const newThisMonth = members.filter(m => {
    const d = new Date(m.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const openPastoral = pastoralCases.length;

  const stats = [
    { title: "Total Members", value: total, change: `+${newThisMonth} this month`, icon: Users, color: "text-primary" },
    { title: "Upcoming Events", value: events.length, change: events[0] ? `Next: ${events[0].title}` : "No upcoming events", icon: CalendarDays, color: "text-accent" },
    { title: "First Timers", value: firstTimers, change: "Awaiting follow-up", icon: UserPlus, color: "text-chart-3" },
    { title: "Pastoral Cases", value: openPastoral, change: `${pastoralCases.filter(c => c.status === "Open").length} open`, icon: Heart, color: "text-chart-5" },
  ];

  const waterBaptism = members.filter(m => m.water_baptism).length;
  const hsBaptism = members.filter(m => m.holy_spirit_baptism).length;
  const bfcCompleted = members.filter(m => m.bfc_completed).length;
  const winnersSatellite = members.filter(m => m.winners_satellite).length;

  const growthMetrics = [
    { label: "Water Baptism", value: waterBaptism, total },
    { label: "Holy Spirit Baptism", value: hsBaptism, total },
    { label: "BFC Completed", value: bfcCompleted, total },
    { label: "Winners Satellite", value: winnersSatellite, total },
  ];

  const recentActivity = [
    ...recentMembers.map(m => ({
      text: `${m.first_name} ${m.last_name} registered`,
      sub: m.membership_status,
      time: timeAgo(m.created_at),
      _ts: new Date(m.created_at).getTime(),
    })),
    ...recentFollowups.map(f => ({
      text: f.description || `${f.followup_type} follow-up`,
      sub: f.status,
      time: timeAgo(f.created_at),
      _ts: new Date(f.created_at).getTime(),
    })),
  ].sort((a, b) => b._ts - a._ts).slice(0, 6);

  if (membersLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileCompletionBanner />
      <SelfCheckInWidget />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl sm:text-3xl font-display font-bold text-foreground mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              Growth Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {growthMetrics.map((m) => (
              <div key={m.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-foreground">{m.label}</span>
                  <span className="text-muted-foreground">{m.value} / {m.total} ({m.total > 0 ? Math.round(m.value / m.total * 100) : 0}%)</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${m.total > 0 ? (m.value / m.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-display">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <div className="h-2 w-2 rounded-full bg-accent mt-2 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{a.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.sub} · {a.time}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}
