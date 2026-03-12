import React from "react";
import { Users, CalendarDays, HeartHandshake, Heart, TrendingUp, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stats = [
  { title: "Total Members", value: "248", change: "+12 this month", icon: Users, color: "text-primary" },
  { title: "Upcoming Events", value: "5", change: "Next: Sunday Service", icon: CalendarDays, color: "text-accent" },
  { title: "First Timers", value: "8", change: "Awaiting follow-up", icon: UserPlus, color: "text-chart-3" },
  { title: "Pastoral Cases", value: "14", change: "3 urgent", icon: Heart, color: "text-chart-5" },
];

const recentActivity = [
  { type: "member", text: "Sarah Johnson registered", sub: "Active Member", time: "2 hours ago" },
  { type: "event", text: "Youth Bible Study created", sub: "Youth Ministry", time: "4 hours ago" },
  { type: "followup", text: "Follow-up with David Obi", sub: "Phone call scheduled", time: "Yesterday" },
  { type: "pastoral", text: "Prayer request from Grace Eze", sub: "Pastoral Care", time: "Yesterday" },
  { type: "member", text: "James Adeyemi updated profile", sub: "Growth milestone: BFC", time: "2 days ago" },
  { type: "event", text: "Easter Conference registration open", sub: "248 capacity", time: "3 days ago" },
];

const growthMetrics = [
  { label: "Water Baptism", value: 72, total: 248 },
  { label: "Holy Spirit Baptism", value: 58, total: 248 },
  { label: "BFC Completed", value: 95, total: 248 },
  { label: "Winners Satellite", value: 120, total: 248 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-display font-bold text-foreground mt-1">{stat.value}</p>
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
        {/* Growth Indices */}
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
                  <span className="text-muted-foreground">{m.value} / {m.total} ({Math.round(m.value / m.total * 100)}%)</span>
                </div>
                <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${(m.value / m.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-display">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <div className="h-2 w-2 rounded-full bg-accent mt-2 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">{a.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.sub} · {a.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
