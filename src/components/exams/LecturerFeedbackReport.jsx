import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Loader2, BarChart3, Download, Printer, RotateCcw, TrendingUp, TrendingDown, Minus, Trash2 } from "lucide-react";
import { OPTION_LABELS, CATEGORICAL_FIELDS } from "@/lib/lecturer-feedback-options";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PasswordConfirmDialog from "@/components/shared/PasswordConfirmDialog";
import { toast } from "@/components/ui/use-toast";
import { logAudit } from "@/lib/audit";

const emptyFilters = {
  courseId: "all",
  subjectId: "all",
  lecturerId: "all",
  level: "all",
  from: "",
  to: "",
  minRating: 1,
  haveAgain: "all",
  search: "",
};

function toCSV(rows) {
  const headers = [
    "date","course","subject","lecturer","level","student","overall_rating",
    "session_description","delivery","time_keeping","class_atmosphere","test_quality","have_again","comments",
  ];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      new Date(r.created_at).toISOString().slice(0, 10),
      r.exam_titles?.name || "",
      r.exam_subjects?.name || "",
      r.lecturers?.name || "",
      r.level || "",
      r.members ? `${r.members.first_name} ${r.members.last_name}` : "",
      r.overall_rating ?? "",
      OPTION_LABELS.session_description[r.session_description] || "",
      OPTION_LABELS.delivery[r.delivery] || "",
      OPTION_LABELS.time_keeping[r.time_keeping] || "",
      OPTION_LABELS.class_atmosphere[r.class_atmosphere] || "",
      OPTION_LABELS.test_quality[r.test_quality] || "",
      OPTION_LABELS.have_again[r.have_again] || "",
      r.comments || "",
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

export default function LecturerFeedbackReport() {
  const { tenantId } = useTenantQuery();
  const { isTenantAdmin, isTenantOwner, roles = [] } = useAuth();
  const isSuperAdmin = roles.includes("super_admin") || roles.includes("admin");
  const canDelete = isTenantAdmin || isTenantOwner || isSuperAdmin;
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(emptyFilters);
  const [activeTab, setActiveTab] = useState("lecturer");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("lecturer_ratings")
        .delete()
        .eq("id", pendingDelete.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      await logAudit("lecturer_rating_delete", "lecturer_ratings", pendingDelete.id, {
        lecturer: pendingDelete.lecturers?.name,
        student: pendingDelete.members
          ? `${pendingDelete.members.first_name} ${pendingDelete.members.last_name}`
          : null,
        subject: pendingDelete.exam_subjects?.name,
      }, tenantId);
      queryClient.invalidateQueries({ queryKey: ["lecturer-ratings-report", tenantId] });
      toast({ title: "Feedback deleted" });
      setPendingDelete(null);
    } catch (err) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };


  const { data: ratings = [], isLoading } = useQuery({
    queryKey: ["lecturer-ratings-report", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecturer_ratings")
        .select("*, lecturers(id,name,level), members(first_name,last_name), exam_titles(id,name), exam_subjects(id,name,course_id)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const courses = useMemo(() => {
    const m = new Map();
    ratings.forEach((r) => { if (r.exam_titles) m.set(r.exam_titles.id, r.exam_titles.name); });
    return Array.from(m.entries());
  }, [ratings]);

  const subjects = useMemo(() => {
    const m = new Map();
    ratings.forEach((r) => {
      if (r.exam_subjects && (filters.courseId === "all" || r.course_id === filters.courseId)) {
        m.set(r.exam_subjects.id, r.exam_subjects.name);
      }
    });
    return Array.from(m.entries());
  }, [ratings, filters.courseId]);

  const lecturers = useMemo(() => {
    const m = new Map();
    ratings.forEach((r) => { if (r.lecturers) m.set(r.lecturers.id, r.lecturers.name); });
    return Array.from(m.entries());
  }, [ratings]);

  const levels = useMemo(() => {
    const s = new Set();
    ratings.forEach((r) => { if (r.level) s.add(r.level); });
    return Array.from(s);
  }, [ratings]);

  const filtered = useMemo(() => {
    return ratings.filter((r) => {
      if (filters.courseId !== "all" && r.course_id !== filters.courseId) return false;
      if (filters.subjectId !== "all" && r.subject_id !== filters.subjectId) return false;
      if (filters.lecturerId !== "all" && r.lecturer_id !== filters.lecturerId) return false;
      if (filters.level !== "all" && r.level !== filters.level) return false;
      if (filters.haveAgain !== "all" && r.have_again !== filters.haveAgain) return false;
      if (filters.minRating > 1 && (r.overall_rating || 0) < filters.minRating) return false;
      if (filters.from && new Date(r.created_at) < new Date(filters.from)) return false;
      if (filters.to) {
        const to = new Date(filters.to); to.setHours(23, 59, 59, 999);
        if (new Date(r.created_at) > to) return false;
      }
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        const student = r.members ? `${r.members.first_name} ${r.members.last_name}`.toLowerCase() : "";
        const comments = (r.comments || "").toLowerCase();
        if (!student.includes(q) && !comments.includes(q)) return false;
      }
      return true;
    });
  }, [ratings, filters]);

  const summary = useMemo(() => {
    const n = filtered.length;
    const avg = n ? filtered.reduce((s, r) => s + (r.overall_rating || 0), 0) / n : 0;
    const uniqLect = new Set(filtered.map((r) => r.lecturer_id)).size;
    const pct = (fn) => n ? Math.round((filtered.filter(fn).length / n) * 100) : 0;
    const haveAgainYes = pct((r) => r.have_again === "yes");
    const deliveryGood = pct((r) => ["clear_simple", "interactive"].includes(r.delivery));
    const timeGood = pct((r) => ["on_time", "just_right"].includes(r.time_keeping));

    // Trend: last 30d vs prior 30d
    const now = Date.now();
    const d30 = 30 * 86400000;
    const recent = filtered.filter((r) => now - new Date(r.created_at).getTime() <= d30);
    const prior = filtered.filter((r) => {
      const t = now - new Date(r.created_at).getTime();
      return t > d30 && t <= 2 * d30;
    });
    const recentAvg = recent.length ? recent.reduce((s, r) => s + (r.overall_rating || 0), 0) / recent.length : null;
    const priorAvg = prior.length ? prior.reduce((s, r) => s + (r.overall_rating || 0), 0) / prior.length : null;
    let trend = null;
    if (recentAvg !== null && priorAvg !== null) {
      const diff = recentAvg - priorAvg;
      trend = { diff, dir: diff > 0.1 ? "up" : diff < -0.1 ? "down" : "flat" };
    }
    return { n, avg, uniqLect, haveAgainYes, deliveryGood, timeGood, trend };
  }, [filtered]);

  const byLecturer = useMemo(() => {
    const groups = new Map();
    filtered.forEach((r) => {
      const id = r.lecturer_id;
      if (!groups.has(id)) groups.set(id, { id, name: r.lecturers?.name || "—", rows: [] });
      groups.get(id).rows.push(r);
    });
    return Array.from(groups.values()).map((g) => ({
      id: g.id,
      name: g.name,
      count: g.rows.length,
      avg: g.rows.reduce((s, r) => s + (r.overall_rating || 0), 0) / g.rows.length,
      haveAgainYes: Math.round((g.rows.filter((r) => r.have_again === "yes").length / g.rows.length) * 100),
    })).sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  const bySubject = useMemo(() => {
    const groups = new Map();
    filtered.forEach((r) => {
      if (!r.subject_id) return;
      const key = r.subject_id;
      if (!groups.has(key)) groups.set(key, { id: key, subject: r.exam_subjects?.name || "—", course: r.exam_titles?.name || "—", rows: [] });
      groups.get(key).rows.push(r);
    });
    return Array.from(groups.values()).map((g) => ({
      ...g,
      count: g.rows.length,
      avg: g.rows.reduce((s, r) => s + (r.overall_rating || 0), 0) / g.rows.length,
    })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const byCourse = useMemo(() => {
    const groups = new Map();
    filtered.forEach((r) => {
      if (!r.course_id) return;
      const key = r.course_id;
      if (!groups.has(key)) groups.set(key, { id: key, course: r.exam_titles?.name || "—", rows: [] });
      groups.get(key).rows.push(r);
    });
    return Array.from(groups.values()).map((g) => ({
      ...g,
      count: g.rows.length,
      avg: g.rows.reduce((s, r) => s + (r.overall_rating || 0), 0) / g.rows.length,
      haveAgainYes: Math.round((g.rows.filter((r) => r.have_again === "yes").length / g.rows.length) * 100),
    })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const ratingHistogram = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({ rating: i + 1, count: 0 }));
    filtered.forEach((r) => {
      const v = r.overall_rating;
      if (v >= 1 && v <= 10) buckets[v - 1].count++;
    });
    return buckets;
  }, [filtered]);

  const distribution = useMemo(() => {
    return CATEGORICAL_FIELDS.map((f) => {
      const counts = {};
      filtered.forEach((r) => {
        const v = r[f.key];
        if (!v) return;
        counts[v] = (counts[v] || 0) + 1;
      });
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      const options = Object.keys(OPTION_LABELS[f.key]).map((k) => ({
        key: k,
        label: OPTION_LABELS[f.key][k],
        count: counts[k] || 0,
        pct: total ? Math.round(((counts[k] || 0) / total) * 100) : 0,
      }));
      return { field: f.key, label: f.label, options, total };
    });
  }, [filtered]);

  const downloadCSV = () => {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lecturer-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-0 shadow-sm min-w-0">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Feedback Report & Analytics
            </CardTitle>
            <CardDescription>Filter, analyse and export lecturer feedback.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={downloadCSV} disabled={!filtered.length}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 min-w-0">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 border rounded-lg bg-muted/30 min-w-0">
          <div>
            <Label className="text-xs">Course</Label>
            <Select value={filters.courseId} onValueChange={(v) => setFilters((f) => ({ ...f, courseId: v, subjectId: "all" }))}>
              <SelectTrigger className="h-8 text-xs [&>span]:truncate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Select value={filters.subjectId} onValueChange={(v) => setFilters((f) => ({ ...f, subjectId: v }))}>
              <SelectTrigger className="h-8 text-xs [&>span]:truncate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Lecturer</Label>
            <Select value={filters.lecturerId} onValueChange={(v) => setFilters((f) => ({ ...f, lecturerId: v }))}>
              <SelectTrigger className="h-8 text-xs [&>span]:truncate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lecturers</SelectItem>
                {lecturers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Level</Label>
            <Select value={filters.level} onValueChange={(v) => setFilters((f) => ({ ...f, level: v }))}>
              <SelectTrigger className="h-8 text-xs [&>span]:truncate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-8 text-xs" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-8 text-xs" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Have again</Label>
            <Select value={filters.haveAgain} onValueChange={(v) => setFilters((f) => ({ ...f, haveAgain: v }))}>
              <SelectTrigger className="h-8 text-xs [&>span]:truncate"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                {Object.entries(OPTION_LABELS.have_again).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Min overall rating: {filters.minRating}</Label>
            <Slider min={1} max={10} step={1} value={[filters.minRating]} onValueChange={([v]) => setFilters((f) => ({ ...f, minRating: v }))} className="mt-2" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <Label className="text-xs">Search (student name or comment)</Label>
            <Input className="h-8 text-xs" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Search…" />
          </div>
          <div className="flex items-end">
            <Button size="sm" variant="ghost" className="gap-1.5 w-full" onClick={() => setFilters(emptyFilters)}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <SummaryTile label="Submissions" value={summary.n} />
              <SummaryTile label="Lecturers rated" value={summary.uniqLect} />
              <SummaryTile
                label="Avg rating"
                value={summary.n ? `${summary.avg.toFixed(1)}/10` : "—"}
                trend={summary.trend}
              />
              <SummaryTile label="% Have again" value={summary.n ? `${summary.haveAgainYes}%` : "—"} />
              <SummaryTile label="% Good delivery" value={summary.n ? `${summary.deliveryGood}%` : "—"} />
              <SummaryTile label="% Good timing" value={summary.n ? `${summary.timeGood}%` : "—"} />
            </div>

            {/* Breakdowns */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="lecturer">By lecturer</TabsTrigger>
                <TabsTrigger value="subject">By subject</TabsTrigger>
                <TabsTrigger value="course">By course</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
              </TabsList>

              <TabsContent value="lecturer" className="mt-3">
                {byLecturer.length === 0 ? <EmptyState /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lecturer</TableHead>
                          <TableHead className="text-right">Submissions</TableHead>
                          <TableHead className="text-right">Avg rating</TableHead>
                          <TableHead className="text-right">% Have again</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byLecturer.map((g) => (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">{g.name}</TableCell>
                            <TableCell className="text-right">{g.count}</TableCell>
                            <TableCell className="text-right">{g.avg.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{g.haveAgainYes}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="subject" className="mt-3">
                {bySubject.length === 0 ? <EmptyState /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead className="text-right">Submissions</TableHead>
                          <TableHead className="text-right">Avg rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bySubject.map((g) => (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">{g.subject}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{g.course}</TableCell>
                            <TableCell className="text-right">{g.count}</TableCell>
                            <TableCell className="text-right">{g.avg.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="course" className="mt-3">
                {byCourse.length === 0 ? <EmptyState /> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead className="text-right">Submissions</TableHead>
                          <TableHead className="text-right">Avg rating</TableHead>
                          <TableHead className="text-right">% Have again</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byCourse.map((g) => (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">{g.course}</TableCell>
                            <TableCell className="text-right">{g.count}</TableCell>
                            <TableCell className="text-right">{g.avg.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{g.haveAgainYes}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="distribution" className="mt-3 space-y-4">
                {filtered.length === 0 ? <EmptyState /> : (
                  <>
                    <div className="min-w-0">
                      <p className="text-xs font-medium mb-2">Overall rating distribution</p>
                      <div className="w-full min-w-0">
                        {activeTab === "distribution" && (
                          <ResponsiveContainer width="100%" height={192} debounce={50}>
                            <BarChart data={ratingHistogram}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                              <Tooltip />
                              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                    {distribution.map((d) => (
                      <div key={d.field} className="space-y-1.5">
                        <p className="text-xs font-medium">{d.label}</p>
                        <div className="space-y-1">
                          {d.options.map((o) => (
                            <div key={o.key} className="flex items-center gap-2 text-xs">
                              <span className="w-40 truncate text-muted-foreground">{o.label}</span>
                              <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${o.pct}%` }} />
                              </div>
                              <span className="w-16 text-right tabular-nums">{o.count} ({o.pct}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value, trend }) {
  return (
    <div className="border rounded-lg p-2.5 min-h-[68px] min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 min-w-0">
        <p className="text-lg font-semibold truncate">{value}</p>
        {trend && (
          <Badge variant="outline" className="text-[9px] gap-0.5 px-1.5 shrink-0">
            {trend.dir === "up" && <TrendingUp className="h-3 w-3 text-chart-3" />}
            {trend.dir === "down" && <TrendingDown className="h-3 w-3 text-destructive" />}
            {trend.dir === "flat" && <Minus className="h-3 w-3" />}
            {trend.diff > 0 ? "+" : ""}{trend.diff.toFixed(1)}
          </Badge>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return <p className="text-sm text-muted-foreground text-center py-6">No feedback matches the current filters.</p>;
}
