import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Loader2, ClipboardCheck, Download, Printer, RotateCcw, Plus, Eye, Edit, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import QcCheckDialog from "@/components/exams/QcCheckDialog";
import { YES_NO_FIELDS, SCORE_FIELDS } from "@/lib/qc-options";

const emptyFilters = {
  courseId: "all",
  subjectId: "all",
  lecturerId: "all",
  tier: "all",
  from: "",
  to: "",
  minTotal: 0,
  qcMember: "",
};

function fmtBool(v) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function toCSV(rows) {
  const headers = [
    "date","lecturer","course","subject","tier","qc_member",
    "started_on_time","finished_on_time","introduced_self",
    "orderliness_score","orderliness_note","content_focus_score","content_focus_note",
    "conducted_test","qa_observations","general_observations",
    "class_recorded","recording_submitted","total_score","student_avg_rating",
  ];
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([
      r.check_date,
      r.lecturers?.name || "",
      r.exam_titles?.name || "",
      r.exam_subjects?.name || "",
      r.tier || "",
      r.qc_member_name || "",
      r.started_on_time ?? "",
      r.finished_on_time ?? "",
      fmtBool(r.introduced_self),
      r.orderliness_score ?? "",
      r.orderliness_note || "",
      r.content_focus_score ?? "",
      r.content_focus_note || "",
      fmtBool(r.conducted_test),
      r.qa_observations || "",
      r.general_observations || "",
      fmtBool(r.class_recorded),
      fmtBool(r.recording_submitted),
      r.total_score ?? "",
      r.student_avg_rating ?? "",
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

function SummaryTile({ label, value }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function QcReport() {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const { user, isAdmin } = useAuth();
  const { currentTenant } = useTenant();
  const { isMemberOfUnit: isTrainingRep } = useUnitMembership("Training Rep");
  const qcEnabled = !!currentTenant?.settings?.wofbi_qc_enabled;
  const canCreate = isAdmin || (isTrainingRep && qcEnabled);
  const canDelete = isAdmin;
  const [filters, setFilters] = useState(emptyFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const { data: checks = [], isLoading } = useQuery({
    queryKey: ["lecturer-qc-checks", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lecturer_qc_checks")
        .select("*, lecturers(id,name,level), exam_titles(id,name), exam_subjects(id,name)")
        .eq("tenant_id", tenantId)
        .order("check_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("lecturer_qc_checks").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lecturer-qc-checks"] });
      toast({ title: "QC check deleted" });
      setDeleteId(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const courses = useMemo(() => {
    const m = new Map();
    checks.forEach((r) => { if (r.exam_titles) m.set(r.exam_titles.id, r.exam_titles.name); });
    return Array.from(m.entries());
  }, [checks]);

  const subjects = useMemo(() => {
    const m = new Map();
    checks.forEach((r) => {
      if (r.exam_subjects && (filters.courseId === "all" || r.exam_title_id === filters.courseId)) {
        m.set(r.exam_subjects.id, r.exam_subjects.name);
      }
    });
    return Array.from(m.entries());
  }, [checks, filters.courseId]);

  const lecturers = useMemo(() => {
    const m = new Map();
    checks.forEach((r) => { if (r.lecturers) m.set(r.lecturers.id, r.lecturers.name); });
    return Array.from(m.entries());
  }, [checks]);

  const tiers = useMemo(() => {
    const s = new Set();
    checks.forEach((r) => { if (r.tier) s.add(r.tier); });
    return Array.from(s);
  }, [checks]);

  const filtered = useMemo(() => {
    return checks.filter((r) => {
      if (filters.courseId !== "all" && r.exam_title_id !== filters.courseId) return false;
      if (filters.subjectId !== "all" && r.exam_subject_id !== filters.subjectId) return false;
      if (filters.lecturerId !== "all" && r.lecturer_id !== filters.lecturerId) return false;
      if (filters.tier !== "all" && r.tier !== filters.tier) return false;
      if (filters.from && r.check_date < filters.from) return false;
      if (filters.to && r.check_date > filters.to) return false;
      if (filters.minTotal > 0 && (r.total_score || 0) < filters.minTotal) return false;
      if (filters.qcMember.trim()) {
        const q = filters.qcMember.trim().toLowerCase();
        if (!(r.qc_member_name || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [checks, filters]);

  const summary = useMemo(() => {
    const n = filtered.length;
    const uniqLect = new Set(filtered.map((r) => r.lecturer_id)).size;
    const avgTotal = n ? filtered.reduce((s, r) => s + (r.total_score || 0), 0) / n : 0;
    const pctScoreGE4 = (key) => {
      const eligible = filtered.filter((r) => r[key] != null);
      if (!eligible.length) return 0;
      return Math.round((eligible.filter((r) => r[key] >= 4).length / eligible.length) * 100);
    };
    const pctBool = (key) => {
      const eligible = filtered.filter((r) => r[key] != null);
      if (!eligible.length) return 0;
      return Math.round((eligible.filter((r) => r[key] === true).length / eligible.length) * 100);
    };
    return {
      n,
      uniqLect,
      avgTotal,
      onTimeStart: pctScoreGE4("started_on_time"),
      onTimeFinish: pctScoreGE4("finished_on_time"),
      introduced: pctBool("introduced_self"),
      testConducted: pctBool("conducted_test"),
      recorded: pctBool("class_recorded"),
      recSubmitted: pctBool("recording_submitted"),
    };
  }, [filtered]);

  const byLecturer = useMemo(() => {
    const g = new Map();
    filtered.forEach((r) => {
      const id = r.lecturer_id;
      if (!g.has(id)) g.set(id, { id, name: r.lecturers?.name || "—", rows: [] });
      g.get(id).rows.push(r);
    });
    const avg = (rows, k) => {
      const v = rows.filter((r) => r[k] != null).map((r) => r[k]);
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
    };
    return Array.from(g.values()).map((x) => ({
      id: x.id,
      name: x.name,
      count: x.rows.length,
      avgTotal: avg(x.rows, "total_score"),
      avgOrder: avg(x.rows, "orderliness_score"),
      avgContent: avg(x.rows, "content_focus_score"),
      onTimeStart: (() => {
        const el = x.rows.filter((r) => r.started_on_time != null);
        return el.length ? Math.round((el.filter((r) => r.started_on_time >= 4).length / el.length) * 100) : 0;
      })(),
    })).sort((a, b) => b.avgTotal - a.avgTotal);
  }, [filtered]);

  const byCourse = useMemo(() => {
    const g = new Map();
    filtered.forEach((r) => {
      if (!r.exam_title_id) return;
      const id = r.exam_title_id;
      if (!g.has(id)) g.set(id, { id, name: r.exam_titles?.name || "—", rows: [] });
      g.get(id).rows.push(r);
    });
    return Array.from(g.values()).map((x) => ({
      id: x.id,
      name: x.name,
      count: x.rows.length,
      avgTotal: x.rows.reduce((s, r) => s + (r.total_score || 0), 0) / x.rows.length,
    })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const totalHistogram = useMemo(() => {
    // buckets of 5: 0-4, 5-9, 10-14, 15-20
    const b = [
      { range: "0–4", count: 0 },
      { range: "5–9", count: 0 },
      { range: "10–14", count: 0 },
      { range: "15–20", count: 0 },
    ];
    filtered.forEach((r) => {
      const t = r.total_score || 0;
      if (t <= 4) b[0].count++;
      else if (t <= 9) b[1].count++;
      else if (t <= 14) b[2].count++;
      else b[3].count++;
    });
    return b;
  }, [filtered]);

  const yesNoDistribution = useMemo(() => {
    return YES_NO_FIELDS.map((f) => {
      const eligible = filtered.filter((r) => r[f.key] != null);
      const yes = eligible.filter((r) => r[f.key] === true).length;
      const no = eligible.filter((r) => r[f.key] === false).length;
      const total = eligible.length;
      return {
        key: f.key,
        label: f.label,
        yes,
        no,
        yesPct: total ? Math.round((yes / total) * 100) : 0,
        noPct: total ? Math.round((no / total) * 100) : 0,
        total,
      };
    });
  }, [filtered]);

  const downloadCSV = () => {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qc-checks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openNew = () => { setEditRecord(null); setDialogOpen(true); };
  const openEdit = (r) => { setEditRecord(r); setDialogOpen(true); };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Quality Control
            </CardTitle>
            <CardDescription>Record and analyse lecturer QC checks against the WOFBI checklist.</CardDescription>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button size="sm" onClick={openNew} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New QC Check
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCSV} disabled={!filtered.length}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 border rounded-lg bg-muted/30">
          <div>
            <Label className="text-xs">Course</Label>
            <Select value={filters.courseId} onValueChange={(v) => setFilters((f) => ({ ...f, courseId: v, subjectId: "all" }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Subject</Label>
            <Select value={filters.subjectId} onValueChange={(v) => setFilters((f) => ({ ...f, subjectId: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Lecturer</Label>
            <Select value={filters.lecturerId} onValueChange={(v) => setFilters((f) => ({ ...f, lecturerId: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lecturers</SelectItem>
                {lecturers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tier</Label>
            <Select value={filters.tier} onValueChange={(v) => setFilters((f) => ({ ...f, tier: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                {tiers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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
            <Label className="text-xs">QC member search</Label>
            <Input className="h-8 text-xs" value={filters.qcMember} onChange={(e) => setFilters((f) => ({ ...f, qcMember: e.target.value }))} placeholder="Name…" />
          </div>
          <div>
            <Label className="text-xs">Min total score: {filters.minTotal}</Label>
            <Slider min={0} max={20} step={1} value={[filters.minTotal]} onValueChange={([v]) => setFilters((f) => ({ ...f, minTotal: v }))} className="mt-2" />
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <SummaryTile label="Checks" value={summary.n} />
              <SummaryTile label="Lecturers" value={summary.uniqLect} />
              <SummaryTile label="Avg total" value={summary.n ? `${summary.avgTotal.toFixed(1)}/20` : "—"} />
              <SummaryTile label="% Started on time" value={summary.n ? `${summary.onTimeStart}%` : "—"} />
              <SummaryTile label="% Finished on time" value={summary.n ? `${summary.onTimeFinish}%` : "—"} />
              <SummaryTile label="% Introduced self" value={summary.n ? `${summary.introduced}%` : "—"} />
              <SummaryTile label="% Test conducted" value={summary.n ? `${summary.testConducted}%` : "—"} />
              <SummaryTile label="% Class recorded" value={summary.n ? `${summary.recorded}%` : "—"} />
              <SummaryTile label="% Recording submitted" value={summary.n ? `${summary.recSubmitted}%` : "—"} />
            </div>

            <Tabs defaultValue="entries">
              <TabsList>
                <TabsTrigger value="entries">Entries</TabsTrigger>
                <TabsTrigger value="lecturer">By lecturer</TabsTrigger>
                <TabsTrigger value="course">By course</TabsTrigger>
                <TabsTrigger value="distribution">Distribution</TabsTrigger>
              </TabsList>

              <TabsContent value="entries" className="mt-3">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No QC checks match the current filters.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Lecturer</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Tier</TableHead>
                          <TableHead>QC Member</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap">{r.check_date}</TableCell>
                            <TableCell className="font-medium">{r.lecturers?.name || "—"}</TableCell>
                            <TableCell>{r.exam_titles?.name || "—"}</TableCell>
                            <TableCell>{r.tier ? <Badge variant="secondary">{r.tier}</Badge> : "—"}</TableCell>
                            <TableCell>{r.qc_member_name || "—"}</TableCell>
                            <TableCell className="text-right font-semibold">{r.total_score ?? "—"}/20</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewRecord(r)}><Eye className="h-3.5 w-3.5" /></Button>
                                {(isAdmin || (canCreate && r.created_by === user?.id)) && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}><Edit className="h-3.5 w-3.5" /></Button>
                                )}
                                {canDelete && (
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lecturer" className="mt-3">
                {byLecturer.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lecturer</TableHead>
                          <TableHead className="text-right">Checks</TableHead>
                          <TableHead className="text-right">Avg total</TableHead>
                          <TableHead className="text-right">Avg orderliness</TableHead>
                          <TableHead className="text-right">Avg content</TableHead>
                          <TableHead className="text-right">% On-time start</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byLecturer.map((g) => (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">{g.name}</TableCell>
                            <TableCell className="text-right">{g.count}</TableCell>
                            <TableCell className="text-right">{g.avgTotal.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{g.avgOrder.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{g.avgContent.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{g.onTimeStart}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="course" className="mt-3">
                {byCourse.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Course</TableHead>
                          <TableHead className="text-right">Checks</TableHead>
                          <TableHead className="text-right">Avg total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {byCourse.map((g) => (
                          <TableRow key={g.id}>
                            <TableCell className="font-medium">{g.name}</TableCell>
                            <TableCell className="text-right">{g.count}</TableCell>
                            <TableCell className="text-right">{g.avgTotal.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="distribution" className="mt-3 space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Total score distribution</h4>
                  <div className="h-52 w-full">
                    <ResponsiveContainer>
                      <BarChart data={totalHistogram}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="range" fontSize={11} />
                        <YAxis fontSize={11} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Yes / No answers</h4>
                  {yesNoDistribution.map((d) => (
                    <div key={d.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{d.label}</span>
                        <span className="text-muted-foreground">{d.total} answers</span>
                      </div>
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-muted">
                        <div className="bg-primary" style={{ width: `${d.yesPct}%` }} title={`Yes: ${d.yes}`} />
                        <div className="bg-destructive/70" style={{ width: `${d.noPct}%` }} title={`No: ${d.no}`} />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Yes {d.yesPct}%</span>
                        <span>No {d.noPct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>

      <QcCheckDialog open={dialogOpen} onOpenChange={setDialogOpen} editRecord={editRecord} />

      {/* View detail */}
      <Dialog open={!!viewRecord} onOpenChange={(o) => !o && setViewRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> QC Check Details
            </DialogTitle>
          </DialogHeader>
          {viewRecord && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Date:</span> {viewRecord.check_date}</div>
                <div><span className="text-muted-foreground">Lecturer:</span> {viewRecord.lecturers?.name || "—"}</div>
                <div><span className="text-muted-foreground">Course:</span> {viewRecord.exam_titles?.name || "—"}</div>
                <div><span className="text-muted-foreground">Subject:</span> {viewRecord.exam_subjects?.name || "—"}</div>
                <div><span className="text-muted-foreground">Tier:</span> {viewRecord.tier || "—"}</div>
                <div><span className="text-muted-foreground">QC Member:</span> {viewRecord.qc_member_name || "—"}</div>
              </div>
              <div className="border-t pt-3 space-y-2">
                {SCORE_FIELDS.map((f) => (
                  <div key={f.key} className="flex justify-between">
                    <span>{f.label}</span>
                    <span className="font-semibold">{viewRecord[f.key] ?? "—"}/5</span>
                  </div>
                ))}
                {viewRecord.orderliness_note && <div><span className="text-muted-foreground">Orderliness note:</span> {viewRecord.orderliness_note}</div>}
                {viewRecord.content_focus_note && <div><span className="text-muted-foreground">Content focus note:</span> {viewRecord.content_focus_note}</div>}
                {YES_NO_FIELDS.map((f) => (
                  <div key={f.key} className="flex justify-between">
                    <span>{f.label}</span>
                    <span className="font-semibold">{fmtBool(viewRecord[f.key])}</span>
                  </div>
                ))}
                {viewRecord.qa_observations && <div><div className="text-muted-foreground">Q&A observations:</div> {viewRecord.qa_observations}</div>}
                {viewRecord.general_observations && <div><div className="text-muted-foreground">General observations:</div> {viewRecord.general_observations}</div>}
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-medium">Total score</span>
                <span className="text-xl font-bold text-primary">{viewRecord.total_score ?? "—"}/20</span>
              </div>
              {viewRecord.student_avg_rating != null && (
                <div className="text-xs text-muted-foreground">Student's average rating of lecturer: {Number(viewRecord.student_avg_rating).toFixed(1)}/10</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete QC check?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
