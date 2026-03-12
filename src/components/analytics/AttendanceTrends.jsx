import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";
import { format, parseISO, subMonths } from "date-fns";

const COLORS = ["#1e3a5f", "#c9a84c", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"];
const SESSION_TYPES = ["Sunday Service", "Midweek Service", "Unit Meeting", "Special Event", "Prayer Meeting"];

export default function AttendanceTrends({ sessions, records }) {
  const now = new Date();

  // Monthly attendance trend (last 12 months)
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i);
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM yy"), Present: 0, Late: 0, Absent: 0, total: 0 };
  });

  records.forEach(r => {
    if (!r.session_date) return;
    try {
      const key = r.session_date.slice(0, 7);
      const slot = months.find(m => m.key === key);
      if (!slot) return;
      slot.total++;
      if (r.status === "Present") slot.Present++;
      else if (r.status === "Late") slot.Late++;
      else if (r.status === "Absent") slot.Absent++;
    } catch {}
  });

  const trendData = months.map(m => ({
    month: m.label,
    "Present": m.Present,
    "Late": m.Late,
    "Absent": m.Absent,
    "Rate %": m.total > 0 ? Math.round(((m.Present + m.Late) / m.total) * 100) : 0,
  }));

  // Peak attendance by session type
  const typeStats = SESSION_TYPES.map(type => {
    const typeSessions = sessions.filter(s => s.session_type === type);
    const typeRecords = records.filter(r => typeSessions.some(s => s.id === r.session_id));
    const present = typeRecords.filter(r => r.status === "Present" || r.status === "Late").length;
    const total = typeRecords.length;
    return {
      name: type.replace(" Service", "").replace(" Meeting", ""),
      "Avg Attendance": typeSessions.length > 0 ? Math.round(present / typeSessions.length) : 0,
      "Sessions": typeSessions.length,
    };
  }).filter(t => t["Sessions"] > 0);

  // Attendance rate by session type (pie-like bar)
  const typeRates = SESSION_TYPES.map(type => {
    const typeSessions = sessions.filter(s => s.session_type === type);
    const typeRecords = records.filter(r => typeSessions.some(s => s.id === r.session_id));
    const present = typeRecords.filter(r => r.status === "Present" || r.status === "Late").length;
    const total = typeRecords.length;
    return {
      name: type.replace(" Service", "").replace(" Meeting", ""),
      "Rate %": total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }).filter(t => sessions.some(s => s.session_type === t.name + " Service" || s.session_type === t.name + " Meeting" || sessions.some(s2 => s2.session_type.startsWith(t.name))));

  return (
    <div className="space-y-6">
      {/* Monthly trend line chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Monthly Attendance Trend (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Present" stroke="#1e3a5f" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Late" stroke="#c9a84c" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Rate % line */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Monthly Attendance Rate % (Last 12 Months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="Rate %" radius={[4, 4, 0, 0]}>
                {trendData.map((entry, i) => (
                  <Cell key={i} fill={entry["Rate %"] >= 75 ? "#10b981" : entry["Rate %"] >= 50 ? "#c9a84c" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Peak attendance by session type */}
      {typeStats.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">Average Attendance by Session Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={typeStats} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Avg Attendance" radius={[4, 4, 0, 0]}>
                  {typeStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}