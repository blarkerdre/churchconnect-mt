import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

const attendanceData = [
  { month: "Oct", attendance: 155 },
  { month: "Nov", attendance: 168 },
  { month: "Dec", attendance: 210 },
  { month: "Jan", attendance: 178 },
  { month: "Feb", attendance: 185 },
  { month: "Mar", attendance: 192 },
];

const membershipData = [
  { name: "Active", value: 195, color: "hsl(160, 50%, 40%)" },
  { name: "Inactive", value: 22, color: "hsl(215, 15%, 45%)" },
  { name: "New Convert", value: 18, color: "hsl(42, 68%, 54%)" },
  { name: "First Timer", value: 13, color: "hsl(280, 40%, 55%)" },
];

const growthData = [
  { month: "Oct", members: 220, firstTimers: 8 },
  { month: "Nov", members: 228, firstTimers: 12 },
  { month: "Dec", members: 235, firstTimers: 15 },
  { month: "Jan", members: 238, firstTimers: 6 },
  { month: "Feb", members: 242, firstTimers: 10 },
  { month: "Mar", members: 248, firstTimers: 8 },
];

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Attendance Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="attendance" fill="hsl(215, 53%, 24%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Membership Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={membershipData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                  {membershipData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader><CardTitle className="text-base font-display">Growth Over Time</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="members" stroke="hsl(215, 53%, 24%)" strokeWidth={2} dot={{ fill: "hsl(215, 53%, 24%)" }} />
                <Line type="monotone" dataKey="firstTimers" stroke="hsl(42, 68%, 54%)" strokeWidth={2} dot={{ fill: "hsl(42, 68%, 54%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
