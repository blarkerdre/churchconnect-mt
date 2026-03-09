import { Heart, TrendingUp, DollarSign, Calendar } from "lucide-react";

const givingStats = [
  { label: "This Month", value: "$24,580", icon: DollarSign },
  { label: "Last Month", value: "$22,340", icon: Calendar },
  { label: "Year to Date", value: "$68,920", icon: TrendingUp },
  { label: "Avg. per Member", value: "$72", icon: Heart },
];

const recentGiving = [
  { name: "Anonymous", amount: "$500", date: "Mar 9, 2026", type: "Tithe" },
  { name: "Sarah Johnson", amount: "$250", date: "Mar 9, 2026", type: "Offering" },
  { name: "Michael Chen", amount: "$100", date: "Mar 8, 2026", type: "Tithe" },
  { name: "James Wilson", amount: "$1,000", date: "Mar 8, 2026", type: "Building Fund" },
  { name: "Anonymous", amount: "$75", date: "Mar 7, 2026", type: "Missions" },
  { name: "Emily Davis", amount: "$150", date: "Mar 7, 2026", type: "Tithe" },
];

export default function Giving() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Giving</h1>
        <p className="text-muted-foreground mt-1">Track tithes, offerings, and donations</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {givingStats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-display font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <h3 className="text-lg font-display font-semibold mb-4">Recent Contributions</h3>
        <div className="space-y-3">
          {recentGiving.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.type}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{item.amount}</p>
                <p className="text-xs text-muted-foreground">{item.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
