import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { UserPlus, CalendarDays, HeartHandshake, Users } from "lucide-react";

const iconMap = {
  member: Users,
  event: CalendarDays,
  firsttimer: UserPlus,
  followup: HeartHandshake,
};

const colorMap = {
  member: "bg-blue-50 text-blue-600",
  event: "bg-emerald-50 text-emerald-600",
  firsttimer: "bg-amber-50 text-amber-600",
  followup: "bg-violet-50 text-violet-600",
};

export default function RecentActivity({ activities }) {
  if (!activities || activities.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400 text-center py-8">No recent activity</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((item, idx) => {
          const Icon = iconMap[item.type] || Users;
          return (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colorMap[item.type] || colorMap.member}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{item.label}</p>
                <p className="text-xs text-slate-400">{item.sub}</p>
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">
                {item.date ? format(new Date(item.date), "dd MMM") : ""}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}