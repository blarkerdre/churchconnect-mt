import { Users, CalendarDays, Heart, TrendingUp } from "lucide-react";

const stats = [
  { label: "Total Members", value: "342", change: "+12 this month", icon: Users, color: "text-primary" },
  { label: "Avg. Attendance", value: "187", change: "+5% vs last week", icon: TrendingUp, color: "text-accent" },
  { label: "Monthly Giving", value: "$24,580", change: "+8% vs last month", icon: Heart, color: "text-destructive" },
  { label: "Upcoming Events", value: "7", change: "Next: Sunday Service", icon: CalendarDays, color: "text-primary" },
];

const recentMembers = [
  { name: "Sarah Johnson", joined: "Mar 5, 2026", role: "Volunteer" },
  { name: "Michael Chen", joined: "Mar 3, 2026", role: "Member" },
  { name: "Emily Davis", joined: "Feb 28, 2026", role: "Youth Leader" },
  { name: "James Wilson", joined: "Feb 25, 2026", role: "Member" },
  { name: "Maria Garcia", joined: "Feb 22, 2026", role: "Choir" },
];

const upcomingEvents = [
  { name: "Sunday Worship Service", date: "Mar 10, 2026", time: "10:00 AM" },
  { name: "Youth Group Meeting", date: "Mar 11, 2026", time: "6:30 PM" },
  { name: "Bible Study", date: "Mar 12, 2026", time: "7:00 PM" },
  { name: "Community Outreach", date: "Mar 15, 2026", time: "9:00 AM" },
];

export default function Dashboard() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back. Here's what's happening at your church.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className="text-2xl font-display font-semibold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Members */}
        <div className="rounded-lg border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-lg font-display font-semibold mb-4">Recent Members</h3>
          <div className="space-y-3">
            {recentMembers.map((member) => (
              <div key={member.name} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
                <span className="text-xs text-muted-foreground">{member.joined}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="rounded-lg border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="text-lg font-display font-semibold mb-4">Upcoming Events</h3>
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <div key={event.name} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{event.name}</p>
                  <p className="text-xs text-muted-foreground">{event.time}</p>
                </div>
                <span className="text-xs text-muted-foreground">{event.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
