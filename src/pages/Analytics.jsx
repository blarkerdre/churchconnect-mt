import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubFeature } from "@/hooks/useSubFeature";

import AnnouncementAnalytics from "@/components/analytics/AnnouncementAnalytics";
import FeedbackSummary from "@/components/feedback/FeedbackSummary";
import MemberMilestoneReport from "@/components/analytics/MemberMilestoneReport";
import StatusConversionReport from "@/components/analytics/StatusConversionReport";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from "date-fns";

const COLORS = [
  "hsl(160, 50%, 40%)",
  "hsl(215, 15%, 45%)",
  "hsl(42, 68%, 54%)",
  "hsl(280, 40%, 55%)",
];

export default function Analytics() {
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 6), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const { enabled: canDownloadReport } = useSubFeature("analytics.download_report");
  const { tenantId, scopeQuery } = useTenantQuery();
  const { isAdmin, isReportsOfficer } = useAuth();
  const canViewReports = isAdmin || isReportsOfficer;

  // Attendance sessions + records
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["analytics-sessions", dateFrom, dateTo, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("attendance_sessions")
          .select("*, attendance_records(id, member_id)")
          .gte("session_date", dateFrom)
          .lte("session_date", dateTo)
          .order("session_date", { ascending: true })
      );
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["analytics-members", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("members").select("id, first_name, last_name, email, phone, membership_status, church_unit, water_baptism, holy_spirit_baptism, bfc_completed, bcc_completed, lcc_completed, ldc_completed, winners_satellite, created_at"));
      if (error) throw error;
      return data;
    },
  });

  // WSF data
  const { data: wsfCentres = [] } = useQuery({
    queryKey: ["analytics-wsf", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("wsf_centres").select("id, name, is_active"));
      if (error) throw error;
      return data;
    },
  });

  const { data: wsfReports = [] } = useQuery({
    queryKey: ["analytics-wsf-reports", dateFrom, dateTo, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("wsf_attendance_reports")
          .select("centre_id, meeting_date, male, female, children, first_timers, testimonies")
          .gte("meeting_date", dateFrom)
          .lte("meeting_date", dateTo)
      );
      if (error) throw error;
      return data;
    },
  });

  // Attendance trend by month — use MAX(digital check-ins, reported total_count)
  // so demographic-only sessions (no digital check-ins) still appear in the trend.
  const attendanceTrend = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      const month = format(parseISO(s.session_date), "MMM yyyy");
      if (!map[month]) map[month] = { month, attendance: 0, sessions: 0 };
      const checkins = s.attendance_records?.length || 0;
      const reported = s.total_count || 0;
      map[month].attendance += Math.max(checkins, reported);
      map[month].sessions += 1;
    });
    return Object.values(map);
  }, [sessions]);

  // Membership breakdown
  const membershipBreakdown = useMemo(() => {
    const counts = { Active: 0, Inactive: 0, "New Convert": 0, "First Timer": 0, Visitor: 0 };
    members.forEach(m => { counts[m.membership_status] = (counts[m.membership_status] || 0) + 1; });
    return Object.entries(counts).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [members]);

  const activeMembers = useMemo(() => members.filter(m => m.membership_status === "Active"), [members]);

  // Growth indices — use Active members as denominator and only count Active completions
  const growthIndices = useMemo(() => {
    const indices = [
      { label: "Water Baptism", key: "water_baptism" },
      { label: "HS Baptism", key: "holy_spirit_baptism" },
      { label: "BFC", key: "bfc_completed" },
      { label: "BCC", key: "bcc_completed" },
      { label: "LCC", key: "lcc_completed" },
      { label: "LDC", key: "ldc_completed" },
      { label: "Home Cell", key: "winners_satellite" },
    ];
    return indices.map(({ label, key }) => ({
      label,
      completed: activeMembers.filter(m => m[key]).length,
      total: activeMembers.length,
    }));
  }, [activeMembers]);

  // Church units breakdown
  const unitBreakdown = useMemo(() => {
    const map = {};
    members.forEach(m => {
      if (m.church_unit) {
        m.church_unit.split(",").map(u => u.trim()).filter(Boolean).forEach(u => {
          map[u] = (map[u] || 0) + 1;
        });
      }
    });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] })).sort((a, b) => b.value - a.value);
  }, [members]);

  // WSF analytics from reports
  const wsfAnalytics = useMemo(() => {
    const activeCentres = wsfCentres.filter(c => c.is_active).length;
    const centreStats = {};
    let totalMale = 0, totalFemale = 0, totalChildren = 0, totalFirstTimers = 0, totalTestimonies = 0;
    wsfReports.forEach(r => {
      const total = r.male + r.female + r.children;
      totalMale += r.male;
      totalFemale += r.female;
      totalChildren += r.children;
      totalFirstTimers += r.first_timers;
      totalTestimonies += r.testimonies;
      centreStats[r.centre_id] = (centreStats[r.centre_id] || 0) + total;
    });
    const totalAttendance = totalMale + totalFemale + totalChildren;
    const centreData = wsfCentres.map(c => ({
      name: c.name,
      attendance: centreStats[c.id] || 0,
    })).filter(c => c.attendance > 0);
    return { activeCentres, totalAttendance, centreData, totalMale, totalFemale, totalChildren, totalFirstTimers, totalTestimonies };
  }, [wsfCentres, wsfReports]);

  // Growth over time (members created per month)
  const growthOverTime = useMemo(() => {
    const map = {};
    members.forEach(m => {
      const month = format(parseISO(m.created_at), "MMM yyyy");
      if (!map[month]) map[month] = { month, members: 0, firstTimers: 0 };
      map[month].members += 1;
      if (m.membership_status === "First Timer") map[month].firstTimers += 1;
    });
    return Object.values(map).slice(-12);
  }, [members]);

  const isLoading = loadingSessions || loadingMembers;

  const generateReport = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["ANALYTICS REPORT", `${dateFrom} to ${dateTo}`].join(","),
      "",
      ["Membership Summary"].join(","),
      ["Status", "Count"].join(","),
      ...membershipBreakdown.map(m => [esc(m.name), m.value].join(",")),
      ["Total", members.length].join(","),
      "",
      ["Attendance Summary"].join(","),
      ["Metric", "Value"].join(","),
      ["Total Sessions", sessions.length].join(","),
      ["Total Check-ins", sessions.reduce((sum, s) => sum + (s.attendance_records?.length || 0), 0)].join(","),
      "",
      ["Growth Indices"].join(","),
      ["Milestone", "Completed", "Total", "Percentage"].join(","),
      ...growthIndices.map(g => [esc(g.label), g.completed, g.total, g.total > 0 ? Math.round(g.completed / g.total * 100) + "%" : "0%"].join(",")),
      "",
      ["Church Units"].join(","),
      ["Unit", "Members"].join(","),
      ...unitBreakdown.map(u => [esc(u.name), u.value].join(",")),
      "",
      ["Home Cell Centres"].join(","),
      ["Metric", "Value"].join(","),
      ["Active Centres", wsfAnalytics.activeCentres].join(","),
      ["Total Attendance", wsfAnalytics.totalAttendance].join(","),
      ["Male", wsfAnalytics.totalMale].join(","),
      ["Female", wsfAnalytics.totalFemale].join(","),
      ["Children", wsfAnalytics.totalChildren].join(","),
      ["First Timers", wsfAnalytics.totalFirstTimers].join(","),
      ["Testimonies", wsfAnalytics.totalTestimonies].join(","),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `analytics-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
        {isAdmin && <TabsTrigger value="announcements">Announcements</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
      {/* Date Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
            </div>
            {canDownloadReport && (
              <Button variant="outline" size="sm" onClick={generateReport}>
                <FileText className="h-4 w-4 mr-2" /> Download Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{members.length}</p><p className="text-xs text-muted-foreground">Total Members</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{members.filter(m => m.membership_status === "Active").length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{sessions.length}</p><p className="text-xs text-muted-foreground">Sessions</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{wsfAnalytics.activeCentres}</p><p className="text-xs text-muted-foreground">Home Cell Centres</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Attendance Trend</CardTitle></CardHeader>
          <CardContent>
            {attendanceTrend.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No attendance data in range</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={attendanceTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="attendance" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Membership Breakdown */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Membership Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={membershipBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                  {membershipBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Growth Indices */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-display">Spiritual Development</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">% of Active members ({activeMembers.length})</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={growthIndices} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(val, name) => [val, name === "completed" ? "Completed" : "Total"]} />
                <Bar dataKey="completed" fill="hsl(160, 50%, 40%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Church Units */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Church Units</CardTitle></CardHeader>
          <CardContent>
            {unitBreakdown.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No unit data</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={unitBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(42, 68%, 54%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Home Cell Centre Attendance */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Home Cell Centre Attendance</CardTitle></CardHeader>
          <CardContent>
            {wsfAnalytics.centreData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No Home Cell data in range</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={wsfAnalytics.centreData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="attendance" fill="hsl(280, 40%, 55%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Growth Over Time */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Member Growth Over Time</CardTitle></CardHeader>
          <CardContent>
            {growthOverTime.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No growth data</p> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={growthOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="members" stroke="hsl(215, 53%, 24%)" strokeWidth={2} dot={{ fill: "hsl(215, 53%, 24%)" }} />
                  <Line type="monotone" dataKey="firstTimers" stroke="hsl(42, 68%, 54%)" strokeWidth={2} dot={{ fill: "hsl(42, 68%, 54%)" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      </TabsContent>

      <TabsContent value="reports" className="space-y-6">
        {isAdmin && <MemberMilestoneReport />}
        {isAdmin && <StatusConversionReport />}
        {isAdmin && <FeedbackSummary />}
      </TabsContent>

      {isAdmin && (
        <TabsContent value="announcements" className="space-y-6">
          <AnnouncementAnalytics />
        </TabsContent>
      )}
    </Tabs>
  );
}
