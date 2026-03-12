import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Users, TrendingUp, UserCheck, Star, ClipboardList, AlertTriangle } from "lucide-react";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import AttendanceTrends from "@/components/analytics/AttendanceTrends";
import MemberConsistency from "@/components/analytics/MemberConsistency";
import AbsenceAlerts from "@/components/analytics/AbsenceAlerts";

const COLORS = ["#1e3a5f", "#c9a84c", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

export default function Analytics() {
  const [tab, setTab] = useState("members");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => base44.entities.Member.list("-created_date", 500),
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["analytics-sessions"],
    queryFn: () => base44.entities.AttendanceSession.list("-date", 200),
    enabled: tab === "attendance" || tab === "consistency" || tab === "alerts",
  });

  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ["analytics-records"],
    queryFn: () => base44.entities.AttendanceRecord.list("-created_date", 5000),
    enabled: tab === "attendance" || tab === "consistency" || tab === "alerts",
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  // --- Summary stats ---
  const total = members.length;
  const active = members.filter(m => m.membership_status === "Active").length;
  const newConverts = members.filter(m => m.membership_status === "New Convert").length;
  const firstTimers = members.filter(m => m.membership_status === "First Timer").length;

  // --- Status distribution ---
  const statusData = [
    { name: "Active", value: active },
    { name: "Inactive", value: members.filter(m => m.membership_status === "Inactive").length },
    { name: "New Convert", value: newConverts },
    { name: "First Timer", value: firstTimers },
  ].filter(d => d.value > 0);

  // --- Gender breakdown ---
  const genderData = [
    { name: "Male", value: members.filter(m => m.gender === "Male").length },
    { name: "Female", value: members.filter(m => m.gender === "Female").length },
  ].filter(d => d.value > 0);

  // --- Growth trend: members by join month (last 12 months) ---
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i);
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM yy"), count: 0 };
  });
  members.forEach(m => {
    if (!m.join_date) return;
    try {
      const key = format(parseISO(m.join_date), "yyyy-MM");
      const slot = months.find(mo => mo.key === key);
      if (slot) slot.count++;
    } catch {}
  });
  const growthData = months.map(m => ({ month: m.label, "New Members": m.count }));

  // --- Cumulative growth ---
  let cumulative = 0;
  const cumulativeData = growthData.map(d => {
    cumulative += d["New Members"];
    return { month: d.month, Members: cumulative };
  });

  // --- Church unit distribution (top 12) ---
  const unitCounts = {};
  members.forEach(m => {
    (m.church_units || []).forEach(u => {
      unitCounts[u] = (unitCounts[u] || 0) + 1;
    });
  });
  const unitData = Object.entries(unitCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  // --- Growth indicators ---
  const wsfCount = members.filter(m => m.winners_satellite).length;
  const baptisedCount = members.filter(m => m.water_baptism).length;
  const hsCount = members.filter(m => m.holy_spirit_baptism).length;
  const bfcCount = members.filter(m => m.bfc_completed).length;
  const growthIndicators = [
    { name: "WSF Members", value: wsfCount },
    { name: "Water Baptised", value: baptisedCount },
    { name: "HS Baptism", value: hsCount },
    { name: "BFC Completed", value: bfcCount },
  ];

  const summaryStats = [
    { label: "Total Members", value: total, icon: Users, color: "text-[#1e3a5f] bg-blue-50" },
    { label: "Active Members", value: active, icon: UserCheck, color: "text-emerald-700 bg-emerald-50" },
    { label: "New Converts", value: newConverts, icon: Star, color: "text-amber-700 bg-amber-50" },
    { label: "First Timers", value: firstTimers, icon: TrendingUp, color: "text-purple-700 bg-purple-50" },
  ];

  const attendanceLoading = (tab !== "members") && (loadingSessions || loadingRecords);

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Members
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Attendance Trends
          </TabsTrigger>
          <TabsTrigger value="consistency" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Consistency
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Absence Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4">
          {attendanceLoading ? <Skeleton className="h-72 rounded-2xl" /> : <AttendanceTrends sessions={sessions} records={records} />}
        </TabsContent>
        <TabsContent value="consistency" className="mt-4">
          {attendanceLoading ? <Skeleton className="h-72 rounded-2xl" /> : <MemberConsistency sessions={sessions} records={records} />}
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          {attendanceLoading ? <Skeleton className="h-72 rounded-2xl" /> : <AbsenceAlerts sessions={sessions} records={records} />}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {summaryStats.map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly new members */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Monthly New Members (Last 12 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={growthData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="New Members" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Membership status pie */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Membership Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Church unit distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Members by Church Unit</CardTitle>
          </CardHeader>
          <CardContent>
            {unitData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No unit data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={unitData} layout="vertical" margin={{ top: 4, right: 8, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={55} />
                  <Tooltip />
                  <Bar dataKey="value" name="Members" radius={[0, 4, 4, 0]}>
                    {unitData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Gender + growth indicators */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Gender Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={genderData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {genderData.map((_, i) => <Cell key={i} fill={["#1e3a5f", "#c9a84c"][i % 2]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Growth Indices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {growthIndicators.map(g => (
                  <div key={g.name} className="bg-slate-50 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-[#1e3a5f]">{g.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{g.name}</p>
                    <p className="text-xs text-slate-400">{total > 0 ? `${Math.round((g.value / total) * 100)}%` : "0%"}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}