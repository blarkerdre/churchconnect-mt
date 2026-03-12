import React from "react";
import { Card } from "@/components/ui/card";

export default function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <Card className="p-6 border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-slate-800 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}