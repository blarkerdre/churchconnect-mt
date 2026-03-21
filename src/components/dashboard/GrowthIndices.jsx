import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Droplets, Flame, Users, BookOpen, TrendingUp } from "lucide-react";

export default function GrowthIndices({ members }) {
  const total = members.length || 1;

  const indices = [
    {
      label: "Water Baptism",
      icon: Droplets,
      count: members.filter((m) => m.water_baptism).length,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Holy Spirit Baptism",
      icon: Flame,
      count: members.filter((m) => m.holy_spirit_baptism).length,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
    {
      label: "Winners Satellite Fellowship",
      icon: Users,
      count: members.filter((m) => m.winners_satellite).length,
      color: "text-violet-500",
      bg: "bg-violet-50",
    },
    {
      label: "Believers Foundation Class (BFC)",
      icon: BookOpen,
      count: members.filter((m) => m.bfc_completed).length,
      color: "text-cyan-500",
      bg: "bg-cyan-50",
    },
    {
      label: "Workers in Training (WIT)",
      icon: BookOpen,
      count: members.filter((m) => m.workers_in_training).length,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      label: "Basic Certificate Course (BCC)",
      icon: BookOpen,
      count: members.filter((m) => m.bcc_completed).length,
      color: "text-teal-500",
      bg: "bg-teal-50",
    },
    {
      label: "Leadership Certificate Course (LCC)",
      icon: BookOpen,
      count: members.filter((m) => m.lcc_completed).length,
      color: "text-indigo-500",
      bg: "bg-indigo-50",
    },
    {
      label: "Leadership Diploma Course (LDC)",
      icon: BookOpen,
      count: members.filter((m) => m.ldc_completed).length,
      color: "text-rose-500",
      bg: "bg-rose-50",
    },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#1e3a5f]" /> Spiritual Development
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {indices.map((item) => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${item.bg}`}>
                    <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                  </div>
                  <span className="text-sm text-slate-600">{item.label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.count} <span className="text-slate-400 font-normal text-xs">({pct}%)</span></span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color.replace("text-", "bg-")}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}