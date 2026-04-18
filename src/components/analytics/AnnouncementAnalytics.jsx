import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Loader2, Megaphone, Heart, TrendingUp, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { format, subDays, parseISO, startOfDay } from "date-fns";

const COLORS = [
  "hsl(160, 50%, 40%)",
  "hsl(215, 53%, 24%)",
  "hsl(42, 68%, 54%)",
  "hsl(280, 40%, 55%)",
  "hsl(15, 70%, 55%)",
];

const RANGES = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  "all": "All time",
};

export default function AnnouncementAnalytics() {
  const { tenantId, scopeQuery } = useTenantQuery();
  const [range, setRange] = useState("30");

  const sinceDate = useMemo(() => {
    if (range === "all") return null;
    return subDays(new Date(), parseInt(range, 10)).toISOString();
  }, [range]);

  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ["announcement-analytics-list", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("announcements")
          .select("id, title, target_audience, created_at, publish_date, is_published")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { data: reactions = [], isLoading: loadingReactions } = useQuery({
    queryKey: ["announcement-analytics-reactions", tenantId, range],
    enabled: !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("announcement_reactions")
        .select("id, announcement_id, user_id, created_at")
        .eq("tenant_id", tenantId);
      if (sinceDate) q = q.gte("created_at", sinceDate);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingAnnouncements || loadingReactions;

  const stats = useMemo(() => {
    const reactionsByAnnouncement = {};
    reactions.forEach((r) => {
      reactionsByAnnouncement[r.announcement_id] = (reactionsByAnnouncement[r.announcement_id] || 0) + 1;
    });

    const enriched = announcements.map((a) => ({
      ...a,
      likeCount: reactionsByAnnouncement[a.id] || 0,
    }));

    const totalLikes = reactions.length;
    const totalAnnouncements = announcements.length;
    const avgLikes = totalAnnouncements > 0 ? (totalLikes / totalAnnouncements).toFixed(1) : "0";
    const mostLiked = [...enriched].sort((a, b) => b.likeCount - a.likeCount)[0];

    // Top 10 by likes
    const top10 = [...enriched]
      .filter((a) => a.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 10)
      .map((a) => ({
        name: a.title.length > 24 ? a.title.slice(0, 24) + "…" : a.title,
        likes: a.likeCount,
      }));

    // Likes per day
    const dayMap = {};
    reactions.forEach((r) => {
      const day = format(startOfDay(parseISO(r.created_at)), "MMM d");
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const likesPerDay = Object.entries(dayMap).map(([day, likes]) => ({ day, likes }));

    // Audience breakdown
    const audienceMap = {};
    reactions.forEach((r) => {
      const a = announcements.find((x) => x.id === r.announcement_id);
      const audience = a?.target_audience || "Unknown";
      audienceMap[audience] = (audienceMap[audience] || 0) + 1;
    });
    const audienceData = Object.entries(audienceMap).map(([name, value], i) => ({
      name,
      value,
      color: COLORS[i % COLORS.length],
    }));

    return { enriched, totalLikes, totalAnnouncements, avgLikes, mostLiked, top10, likesPerDay, audienceData };
  }, [announcements, reactions]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Range filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground">Announcement Engagement</h2>
          <p className="text-sm text-muted-foreground">Track how members are reacting to your announcements.</p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RANGES).map(([k, label]) => (
              <SelectItem key={k} value={k}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Announcements</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.totalAnnouncements}</p>
              </div>
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total likes ({RANGES[range]})</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.totalLikes}</p>
              </div>
              <Heart className="h-5 w-5 text-rose-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg likes / announcement</p>
                <p className="text-2xl font-display font-bold text-foreground">{stats.avgLikes}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Most liked</p>
                <p className="text-sm font-display font-bold text-foreground truncate">
                  {stats.mostLiked?.title || "—"}
                </p>
                <p className="text-xs text-muted-foreground">{stats.mostLiked?.likeCount || 0} likes</p>
              </div>
              <Award className="h-5 w-5 text-accent shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 bar chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Top announcements by likes</CardTitle></CardHeader>
          <CardContent>
            {stats.top10.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No likes yet in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.top10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="likes" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Likes per day */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Likes over time</CardTitle></CardHeader>
          <CardContent>
            {stats.likesPerDay.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No engagement in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.likesPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 20%, 90%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="likes" stroke="hsl(160, 50%, 40%)" strokeWidth={2} dot={{ fill: "hsl(160, 50%, 40%)" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Audience donut */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">Likes by audience</CardTitle></CardHeader>
          <CardContent>
            {stats.audienceData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No audience data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={stats.audienceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                    {stats.audienceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Full table */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display">All announcements</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[300px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.enriched.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                        No announcements yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...stats.enriched]
                      .sort((a, b) => b.likeCount - a.likeCount)
                      .map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="max-w-[200px]">
                            <div className="font-medium text-sm truncate">{a.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {a.publish_date ? format(parseISO(a.publish_date), "dd MMM yyyy") : format(parseISO(a.created_at), "dd MMM yyyy")}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{a.target_audience || "All"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex items-center gap-1 text-sm font-medium">
                              <Heart className="h-3 w-3 text-rose-500" />
                              {a.likeCount}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
