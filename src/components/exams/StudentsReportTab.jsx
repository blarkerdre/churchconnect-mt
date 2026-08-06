import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useExamSessionFilter } from "@/contexts/ExamSessionFilterContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Download, Send, Users, X } from "lucide-react";
import MessageFilteredMembersDialog from "@/components/analytics/MessageFilteredMembersDialog";

const STAGE_LABEL = {
  applied: "Applied",
  registered: "Registered",
  link_sent: "Exam link sent",
  exam_taken: "Exam taken",
  completed: "Completed (passed)",
  incomplete: "Incomplete / failed",
};

const STAGE_STYLE = {
  applied: "bg-muted text-muted-foreground",
  registered: "bg-primary/10 text-primary",
  link_sent: "bg-chart-3/10 text-chart-3",
  exam_taken: "bg-chart-2/10 text-chart-2",
  completed: "bg-green-500/10 text-green-600",
  incomplete: "bg-destructive/10 text-destructive",
};

const ORIGIN_LABEL = {
  public_qr: "QR / Public",
  member_self: "Member",
  admin: "Admin",
};

const fmt = (d) => (d ? new Date(d).toLocaleDateString() : "—");

export default function StudentsReportTab() {
  const { tenantId, scopeQuery } = useTenantQuery();
  const { sessionId, sessionName, applySession } = useExamSessionFilter();

  const [stage, setStage] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [msgTargets, setMsgTargets] = useState(null); // array of recipients

  const { data: courses = [] } = useQuery({
    queryKey: ["exam-titles-basic", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_titles")
        .select("id, name, pass_mark_percentage")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ["students-report-apps", tenantId, sessionId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await applySession(
        scopeQuery(
          supabase
            .from("wofbi_applications")
            .select("id, member_id, course_id, first_name, last_name, email, phone, status, created_at, registration_origin, course:exam_titles(id, name), member:members(id, first_name, last_name, email, phone, user_id), edition:exam_sessions(id, name)")
        )
      ).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: registrations = [], isLoading: regsLoading } = useQuery({
    queryKey: ["students-report-regs", tenantId, sessionId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await applySession(
        scopeQuery(
          supabase
            .from("course_registrations")
            .select("id, member_id, course_id, status, student_number, registered_at, registration_email_sent_at, exam_link_sent_at, registration_origin, course:exam_titles(id, name), members(id, first_name, last_name, email, phone, user_id), edition:exam_sessions(id, name)")
        )
      ).order("registered_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["students-report-subjects", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_subjects")
        .select("id, course_id, is_active")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: attempts = [] } = useQuery({
    queryKey: ["students-report-attempts", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_attempts")
        .select("id, member_id, subject_id, score, total_points, completed_at")
        .eq("tenant_id", tenantId)
        .limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = appsLoading || regsLoading;

  const courseById = useMemo(() => {
    const m = new Map();
    courses.forEach((c) => m.set(c.id, c));
    return m;
  }, [courses]);

  const subjectsByCourse = useMemo(() => {
    const m = new Map();
    subjects.forEach((s) => {
      if (!m.has(s.course_id)) m.set(s.course_id, []);
      m.get(s.course_id).push(s.id);
    });
    return m;
  }, [subjects]);

  const subjectCourse = useMemo(() => {
    const m = new Map();
    subjects.forEach((s) => m.set(s.id, s.course_id));
    return m;
  }, [subjects]);

  // Best attempt per member+subject, grouped by member+course
  const resultByKey = useMemo(() => {
    const best = new Map(); // memberId|subjectId -> {score,total}
    attempts.forEach((a) => {
      if (!a.subject_id || !a.member_id) return;
      const k = `${a.member_id}|${a.subject_id}`;
      const pct = a.total_points > 0 ? a.score / a.total_points : 0;
      const prev = best.get(k);
      const prevPct = prev ? (prev.total_points > 0 ? prev.score / prev.total_points : 0) : -1;
      if (!prev || pct > prevPct) best.set(k, { score: a.score || 0, total_points: a.total_points || 0 });
    });
    const out = new Map(); // memberId|courseId -> { taken, score, total }
    best.forEach((v, k) => {
      const [memberId, subjectId] = k.split("|");
      const courseId = subjectCourse.get(subjectId);
      if (!courseId) return;
      const ck = `${memberId}|${courseId}`;
      const agg = out.get(ck) || { taken: 0, score: 0, total: 0 };
      agg.taken += 1;
      agg.score += v.score;
      agg.total += v.total_points;
      out.set(ck, agg);
    });
    return out;
  }, [attempts, subjectCourse]);

  const rows = useMemo(() => {
    const byKey = new Map();

    const upsert = (key, patch) => {
      const prev = byKey.get(key) || {};
      byKey.set(key, { ...prev, ...patch });
    };

    applications.forEach((a) => {
      const key = a.member_id && a.course_id ? `${a.member_id}|${a.course_id}` : `app:${a.id}`;
      upsert(key, {
        key,
        member_id: a.member_id || null,
        course_id: a.course_id || null,
        course_name: a.course?.name || "—",
        edition_name: a.edition?.name || null,
        first_name: a.member?.first_name || a.first_name || "",
        last_name: a.member?.last_name || a.last_name || "",
        email: a.member?.email || a.email || "",
        phone: a.member?.phone || a.phone || "",
        user_id: a.member?.user_id || null,
        origin: a.registration_origin || (a.member?.user_id ? "member_self" : "public_qr"),
        applied_at: a.created_at,
        application_status: a.status,
      });
    });

    registrations.forEach((r) => {
      const key = r.member_id && r.course_id ? `${r.member_id}|${r.course_id}` : `reg:${r.id}`;
      upsert(key, {
        key,
        member_id: r.member_id || null,
        course_id: r.course_id || null,
        course_name: r.course?.name || byKey.get(key)?.course_name || "—",
        edition_name: r.edition?.name || byKey.get(key)?.edition_name || null,
        first_name: r.members?.first_name || byKey.get(key)?.first_name || "",
        last_name: r.members?.last_name || byKey.get(key)?.last_name || "",
        email: r.members?.email || byKey.get(key)?.email || "",
        phone: r.members?.phone || byKey.get(key)?.phone || "",
        user_id: r.members?.user_id || byKey.get(key)?.user_id || null,
        origin: r.registration_origin || byKey.get(key)?.origin || (r.members?.user_id ? "member_self" : "public_qr"),
        registration_id: r.id,
        registration_status: r.status,
        student_number: r.student_number || null,
        registered_at: r.registered_at,
        registration_email_sent_at: r.registration_email_sent_at,
        exam_link_sent_at: r.exam_link_sent_at,
      });
    });

    return Array.from(byKey.values()).map((row) => {
      const course = row.course_id ? courseById.get(row.course_id) : null;
      const totalSubjects = (subjectsByCourse.get(row.course_id) || []).length;
      const res = row.member_id && row.course_id ? resultByKey.get(`${row.member_id}|${row.course_id}`) : null;
      const pct = res && res.total > 0 ? (res.score / res.total) * 100 : 0;
      const passMark = course?.pass_mark_percentage ?? 50;
      const passed = !!res && res.total > 0 && pct >= passMark && totalSubjects > 0 && res.taken >= totalSubjects;

      let stageKey = "applied";
      if (res && res.taken > 0) {
        stageKey = passed ? "completed" : (totalSubjects > 0 && res.taken >= totalSubjects) || pct < passMark ? "incomplete" : "exam_taken";
      } else if (row.exam_link_sent_at) {
        stageKey = "link_sent";
      } else if (row.registration_id && ["approved", "active"].includes(row.registration_status)) {
        stageKey = "registered";
      }

      return {
        ...row,
        name: `${row.first_name || ""} ${row.last_name || ""}`.trim() || "Unnamed",
        subjects_taken: res?.taken || 0,
        total_subjects: totalSubjects,
        percentage: res ? Math.round(pct) : null,
        passed,
        stage: stageKey,
        activity_at: row.registered_at || row.applied_at,
      };
    }).sort((a, b) => new Date(b.activity_at || 0) - new Date(a.activity_at || 0));
  }, [applications, registrations, courseById, subjectsByCourse, resultByKey]);

  const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const toTs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (stage !== "all" && r.stage !== stage) return false;
      if (courseFilter !== "all" && r.course_id !== courseFilter) return false;
      if (sourceFilter !== "all" && r.origin !== sourceFilter) return false;
      const ts = r.activity_at ? new Date(r.activity_at).getTime() : null;
      if (fromTs && (!ts || ts < fromTs)) return false;
      if (toTs && (!ts || ts > toTs)) return false;
      if (needle) {
        const hay = `${r.name} ${r.email} ${r.phone} ${r.student_number || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, stage, courseFilter, sourceFilter, fromTs, toTs, q]);

  const stats = useMemo(() => {
    const applied = filtered.length;
    const registered = filtered.filter((r) => !!r.registration_id).length;
    const linkSent = filtered.filter((r) => !!r.exam_link_sent_at).length;
    const examTaken = filtered.filter((r) => r.subjects_taken > 0).length;
    const passed = filtered.filter((r) => r.passed).length;
    return {
      applied,
      registered,
      linkSent,
      examTaken,
      passed,
      passRate: examTaken ? Math.round((passed / examTaken) * 100) : 0,
    };
  }, [filtered]);

  const toRecipient = (r) => ({
    id: r.member_id,
    first_name: r.first_name,
    last_name: r.last_name,
    email: r.email,
    phone: r.phone,
    user_id: r.user_id,
  });

  const messageable = (list) => list.filter((r) => r.member_id).map(toRecipient);
  const unlinkedCount = filtered.filter((r) => !r.member_id).length;

  const selectedRows = filtered.filter((r) => selectedIds.has(r.key));
  const allSelected = filtered.length > 0 && selectedRows.length === filtered.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((r) => r.key)));
  };
  const toggleOne = (key) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const clearFilters = () => {
    setStage("all"); setCourseFilter("all"); setSourceFilter("all");
    setDateFrom(""); setDateTo(""); setQ("");
  };

  const exportCsv = () => {
    const header = ["Name", "Email", "Phone", "Course", "Edition", "Student number", "Stage", "Source", "Subjects taken", "Total subjects", "Score %", "Applied", "Registered", "Confirmation sent", "Exam link sent"];
    const lines = filtered.map((r) => [
      r.name, r.email || "", r.phone || "", r.course_name, r.edition_name || "", r.student_number || "",
      STAGE_LABEL[r.stage], ORIGIN_LABEL[r.origin] || r.origin || "", r.subjects_taken, r.total_subjects,
      r.percentage === null ? "" : r.percentage,
      fmt(r.applied_at), fmt(r.registered_at), fmt(r.registration_email_sent_at), fmt(r.exam_link_sent_at),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `bible-school-students-${(sessionName || "all").replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const audienceLabel = [
    stage === "all" ? "all stages" : STAGE_LABEL[stage],
    courseFilter !== "all" ? courseById.get(courseFilter)?.name : null,
    sessionName || null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: "Students", value: stats.applied },
          { label: "Registered", value: stats.registered },
          { label: "Link sent", value: stats.linkSent },
          { label: "Exams taken", value: stats.examTaken },
          { label: "Passed", value: stats.passed },
          { label: "Pass rate", value: `${stats.passRate}%` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground truncate">{s.label}</p>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Students
            <Badge variant="secondary">{filtered.length}</Badge>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button
                size="sm"
                onClick={() => setMsgTargets(messageable(selectedRows.length ? selectedRows : filtered))}
                disabled={!messageable(selectedRows.length ? selectedRows : filtered).length}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Message {selectedRows.length ? `${selectedRows.length} selected` : "filtered"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, student no." className="pl-8" />
            </div>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {Object.entries(STAGE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="public_qr">QR / Public</SelectItem>
                <SelectItem value="member_self">Member self-register</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7 gap-1"><X className="h-3 w-3" /> Clear filters</Button>
            {unlinkedCount > 0 && <span>{unlinkedCount} applicant(s) without a linked member record can't be messaged.</span>}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No students match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden md:table-cell">Course</TableHead>
                    <TableHead className="hidden lg:table-cell">Student no.</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="hidden lg:table-cell">Score</TableHead>
                    <TableHead className="hidden xl:table-cell">Dates</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell><Checkbox checked={selectedIds.has(r.key)} onCheckedChange={() => toggleOne(r.key)} /></TableCell>
                      <TableCell>
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{r.email || r.phone || "—"}</p>
                        <p className="text-[11px] text-muted-foreground md:hidden">{r.course_name}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {r.course_name}
                        {r.edition_name && <span className="block text-[11px] text-muted-foreground">{r.edition_name}</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{r.student_number || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`border-0 text-[11px] ${STAGE_STYLE[r.stage]}`}>{STAGE_LABEL[r.stage]}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        {r.subjects_taken ? `${r.percentage}% · ${r.subjects_taken}/${r.total_subjects}` : "—"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                        <div>Applied {fmt(r.applied_at)}</div>
                        <div>Reg. {fmt(r.registered_at)}</div>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title={r.member_id ? "Message this student" : "No linked member record"}
                          disabled={!r.member_id}
                          onClick={() => setMsgTargets([toRecipient(r)])}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MessageFilteredMembersDialog
        open={!!msgTargets}
        onOpenChange={(v) => { if (!v) setMsgTargets(null); }}
        members={msgTargets || []}
        source="bible_school"
        audienceLabel={`Bible School — ${audienceLabel || "students"}`}
        filterContext={{ stage, course_id: courseFilter, source: sourceFilter, session_id: sessionId, date_from: dateFrom, date_to: dateTo }}
      />
    </div>
  );
}
