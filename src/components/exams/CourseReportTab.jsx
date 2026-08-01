import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Save, RefreshCw, Printer, FileDown, Plus, Trash2, FileText, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { emptyReport, mergeReport, FINDING_FIELDS, QC_CHECKLIST_FIELDS, buildIntroduction, DEFAULT_TESTIMONY_HEADING } from "@/lib/wofbi-report-defaults";
import { printReport, downloadReportDoc, buildReportHtml } from "@/lib/wofbi-report-export";

const NO_SESSION = "__none__";

function TextField({ label, value, onChange, ...rest }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs">{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function AreaField({ label, value, onChange, rows = 4 }) {
  return (
    <div className="space-y-1 min-w-0">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Simple editable list of rows of text fields */
function RowEditor({ rows, columns, onChange, addLabel = "Add row" }) {
  const update = (i, key, val) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {columns.map((c) =>
              c.area ? (
                <div key={c.key} className="sm:col-span-2">
                  <AreaField label={c.label} rows={3} value={r[c.key]} onChange={(v) => update(i, c.key, v)} />
                </div>
              ) : (
                <TextField key={c.key} label={c.label} value={r[c.key]} onChange={(v) => update(i, c.key, v)} />
              ),
            )}
          </div>
          <Button variant="ghost" size="sm" className="text-destructive"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, {}])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
      </Button>
    </div>
  );
}

function LinesEditor({ value, onChange, placeholder }) {
  return (
    <Textarea
      rows={4}
      placeholder={placeholder}
      value={(value || []).join("\n")}
      onChange={(e) => onChange(e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))}
    />
  );
}

export default function CourseReportTab() {
  const { tenantId } = useTenantQuery();
  const { currentTenant } = useTenant();
  const qc = useQueryClient();

  const [courseId, setCourseId] = useState("");
  const [sessionId, setSessionId] = useState(NO_SESSION);
  const [report, setReport] = useState(emptyReport());
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);
  const [status, setStatus] = useState("draft");
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const seededRef = useRef(null);

  const { data: courses = [] } = useQuery({
    queryKey: ["exam-titles-report", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_titles")
        .select("id, name, course_code").eq("tenant_id", tenantId).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["exam-sessions-report", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("exam_sessions")
        .select("id, name, starts_on, ends_on, status").eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedCourse = courses.find((c) => c.id === courseId);

  // Same logo resolution as the Statement of Result, resolved live.
  const { data: liveTemplate } = useQuery({
    queryKey: ["wofbi-report-template", tenantId, selectedCourse?.name],
    enabled: !!tenantId && !!selectedCourse?.name,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("church_name, centre_name, logo_url, wofbi_logo_url, crest_image_url")
        .eq("tenant_id", tenantId)
        .eq("training_type", selectedCourse.name)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const liveLogoUrl =
    liveTemplate?.wofbi_logo_url ||
    liveTemplate?.crest_image_url ||
    liveTemplate?.logo_url ||
    currentTenant?.logo_url ||
    "";

  const { data: existing, isFetching: loadingReport } = useQuery({
    queryKey: ["wofbi-course-report", tenantId, courseId, sessionId],
    enabled: !!tenantId && !!courseId,
    queryFn: async () => {
      let q = supabase.from("wofbi_course_reports").select("*")
        .eq("tenant_id", tenantId).eq("course_id", courseId);
      q = sessionId === NO_SESSION ? q.is("session_id", null) : q.eq("session_id", sessionId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!courseId) return;
    const next = mergeReport(existing?.content);
    if (!existing) {
      // brand-new report: seed the template wording with what we know
      const sessionRow = sessions.find((s) => s.id === sessionId);
      next.cover = {
        ...next.cover,
        church_name: next.cover.church_name || currentTenant?.name || "",
        course_title: selectedCourse?.name || next.cover.course_title,
        course_code: selectedCourse?.course_code || next.cover.course_code,
        edition: sessionRow?.name || next.cover.edition,
      };
      next.introduction = buildIntroduction({
        course: selectedCourse?.name || "",
        edition: sessionRow?.name || "",
        centre: next.cover.centre_name,
        church: next.cover.church_name,
      });
    }
    setReport(next);
    setStatus(existing?.status || "draft");
    setDirty(false);

    // brand-new report: pull live figures once so it isn't empty before "Refresh from data"
    const seedKey = `${courseId}:${sessionId}`;
    if (!existing && seededRef.current !== seedKey) {
      seededRef.current = seedKey;
      setTimeout(() => autofill(), 0);
    }
     
  }, [existing, courseId, sessionId]);

  const reportForExport = {
    ...report,
    cover: { ...report.cover, logo_url: report.cover?.logo_url || liveLogoUrl },
  };

  const handleWordDownload = () => {
    const result = downloadReportDoc(reportForExport);
    if (result === "opened") {
      toast({
        title: "Opened in a new tab",
        description: "Your browser blocked the download — use Share / Save from the new tab to keep the Word file.",
      });
    } else if (result === "failed") {
      toast({
        title: "Download blocked",
        description: "Allow pop-ups or downloads for this site, then try again.",
        variant: "destructive",
      });
    }
  };


  const set = (path, value) => {
    setDirty(true);
    setReport((prev) => {
      const next = { ...prev };
      const keys = path.split(".");
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...(cur[keys[i]] || {}) };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  };


  async function autofill() {
    if (!courseId || !tenantId) return;
    setFilling(true);
    try {
      const sid = sessionId === NO_SESSION ? null : sessionId;
      const course = selectedCourse;

      const [{ data: subjects }, { data: lecturers }, { data: template }] = await Promise.all([
        supabase.from("exam_subjects").select("id, name, code, lecturer_id, sort_order")
          .eq("tenant_id", tenantId).eq("course_id", courseId).order("sort_order"),
        supabase.from("lecturers").select("id, name, lecturer_type").eq("tenant_id", tenantId),
        supabase.from("certificate_templates")
          .select("church_name, centre_name, logo_url, wofbi_logo_url, crest_image_url")
          .eq("tenant_id", tenantId).eq("training_type", course?.name || "").maybeSingle(),
      ]);
      const lecById = Object.fromEntries((lecturers || []).map((l) => [l.id, l.name]));
      const lecTypeById = Object.fromEntries(
        (lecturers || []).map((l) => {
          const t = String(l.lecturer_type || "").trim();
          return [l.id, t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : ""];
        }),
      );
      const subjectList = subjects || [];
      const subjectIds = subjectList.map((s) => s.id);

      let regQ = supabase.from("course_registrations")
        .select("id, member_id, status, members(first_name, last_name, nationality, water_baptism, holy_spirit_baptism, membership_status)")
        .eq("tenant_id", tenantId).eq("course_id", courseId);
      if (sid) regQ = regQ.eq("session_id", sid);

      const [{ data: regs }, { data: applications }, { data: attempts }, { data: ratings }, { data: qcChecks }, { data: testimonies }, { data: attendance }] =
        await Promise.all([
          regQ,
          supabase.from("wofbi_applications").select("id, member_id, answers, status")
            .eq("tenant_id", tenantId).eq("course_id", courseId),
          subjectIds.length
            ? supabase.from("exam_attempts").select("member_id, subject_id")
                .eq("tenant_id", tenantId).in("subject_id", subjectIds)
            : Promise.resolve({ data: [] }),
          supabase.from("lecturer_ratings").select("lecturer_id, subject_id, overall_rating")
            .eq("tenant_id", tenantId).eq("course_id", courseId),
          supabase.from("lecturer_qc_checks")
            .select("lecturer_id, exam_subject_id, qc_member_name, total_score, general_observations, started_on_time, finished_on_time, introduced_self, orderliness_note, orderliness_score, content_focus_note, content_focus_score, conducted_test, qa_observations, class_recorded, recording_submitted")
            .eq("tenant_id", tenantId).eq("exam_title_id", courseId),
          supabase.from("wofbi_feedback_responses")
            .select("answers, submitted_at, members(first_name, last_name)")
            .eq("tenant_id", tenantId).eq("course_id", courseId)
            .order("submitted_at", { ascending: false }),
          supabase.from("wofbi_attendance_records").select("member_id, session_id, wofbi_attendance_sessions!inner(course_id)")
            .eq("tenant_id", tenantId).eq("wofbi_attendance_sessions.course_id", courseId),
        ]);

      const regList = regs || [];
      const appList = applications || [];
      const appCount = appList.length;
      const approved = regList.filter((r) => (r.status || "").toLowerCase() === "approved");

      // application answers keyed by member, used as a fallback for missing member data
      const appByMember = {};
      appList.forEach((a) => {
        if (a.member_id && !appByMember[a.member_id]) appByMember[a.member_id] = a.answers || {};
      });
      const answerOf = (memberId, keys) => {
        const ans = appByMember[memberId] || {};
        for (const k of keys) {
          const v = ans[k];
          if (v !== undefined && v !== null && String(v).trim() !== "") return v;
        }
        return "";
      };
      const isYes = (v) =>
        v === true || ["yes", "true", "y", "1"].includes(String(v).trim().toLowerCase());

      // completed = members with an attempt in every subject
      const bySubj = {};
      (attempts || []).forEach((a) => {
        if (!a.member_id) return;
        (bySubj[a.member_id] = bySubj[a.member_id] || new Set()).add(a.subject_id);
      });
      const completed = Object.values(bySubj).filter((s) => subjectIds.length > 0 && s.size >= subjectIds.length).length;

      // spiritual statistics from student member records, falling back to application answers
      const statBase = approved.length ? approved : regList;
      let waterBaptised = 0;
      let holyGhost = 0;
      let newBirth = 0;
      statBase.forEach((r) => {
        const m = r.members || {};
        if (m.water_baptism || isYes(answerOf(r.member_id, ["water_baptism", "water_baptised", "baptised"])))
          waterBaptised += 1;
        if (m.holy_spirit_baptism || isYes(answerOf(r.member_id, ["holy_spirit_baptism", "holy_ghost_baptism", "holy_ghost"])))
          holyGhost += 1;
        if ((m.membership_status || "").toLowerCase() === "new convert" || isYes(answerOf(r.member_id, ["new_birth", "born_again"])))
          newBirth += 1;
      });

      // nations
      const nationCount = {};
      statBase.forEach((r) => {
        const n = r.members?.nationality || answerOf(r.member_id, ["nationality", "country"]);
        if (n) nationCount[n] = (nationCount[n] || 0) + 1;
      });
      const nations = Object.entries(nationCount)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, count: String(count) }));

      // courses / lecturers
      const courseRows = subjectList.map((s) => ({
        course: s.name,
        code: s.code || "",
        lecturer: lecById[s.lecturer_id] || "",
      }));

      // ratings by subject
      const ratingAgg = {};
      (ratings || []).forEach((r) => {
        const k = r.subject_id || r.lecturer_id;
        if (!k) return;
        const a = (ratingAgg[k] = ratingAgg[k] || { sum: 0, n: 0 });
        a.sum += Number(r.overall_rating) || 0;
        a.n += 1;
      });
      const qcBySubject = {};
      (qcChecks || []).forEach((q) => {
        if (q.exam_subject_id) qcBySubject[q.exam_subject_id] = q;
      });

      const studentFeedback = subjectList.map((s) => {
        const agg = ratingAgg[s.id];
        const q = qcBySubject[s.id];
        return {
          lecturer: lecById[s.lecturer_id] || "",
          course: s.name,
          qc_person: q?.qc_member_name || "",
          qc_rating: q?.total_score != null ? String(q.total_score) : "",
          student_rating: agg && agg.n ? (agg.sum / agg.n).toFixed(1) : "",
        };
      });

      const yesNo = (v) => (v === true ? "Yes" : v === false ? "No" : "");
      const scoreText = (v) => (v === null || v === undefined || v === "" ? "" : String(v));
      const qcRows = subjectList
        .filter((s) => qcBySubject[s.id])
        .map((s) => {
          const q = qcBySubject[s.id];
          return {
            lecturer: lecById[s.lecturer_id] || "",
            course: s.name,
            qc_person: q.qc_member_name || "",
            started_on_time: scoreText(q.started_on_time),
            finished_on_time: scoreText(q.finished_on_time),
            introduced_self: yesNo(q.introduced_self),
            orderliness: q.orderliness_note || scoreText(q.orderliness_score),
            content_focus: q.content_focus_note || scoreText(q.content_focus_score),
            submitted_test: yesNo(q.conducted_test),
            qa: q.qa_observations || "",
            observations: q.general_observations || "",
            class_recorded: yesNo(q.class_recorded),
            recording_submitted: yesNo(q.recording_submitted),
          };
        });

      // honorarium
      const honorarium = subjectList.map((s) => {
        const q = qcBySubject[s.id];
        const agg = ratingAgg[s.id];
        const avg = agg && agg.n ? agg.sum / agg.n : null;
        let remarks;
        if (!q) remarks = "Pending quality control review";
        else if ((avg != null && avg >= 3) || Number(q.total_score) >= 50)
          remarks = "Recommended for honorarium";
        else remarks = "Recommended subject to review";
        return {
          course: s.name,
          code: s.code || "",
          lecturer: lecById[s.lecturer_id] || "",
          type: lecTypeById[s.lecturer_id] || "",
          remarks,
        };
      });
      const perLecturer = {};
      subjectList.forEach((s) => {
        const name = lecById[s.lecturer_id];
        if (!name) return;
        perLecturer[name] = (perLecturer[name] || 0) + 1;
      });
      const rate = Number(report.honorarium_matrix?.rate) || 50;
      const matrixRows = Object.entries(perLecturer).map(([lecturer, n]) => ({
        lecturer,
        courses: String(n),
        amount: `£${n * rate}`,
        cos: "",
      }));

      const attendees = new Set((attendance || []).map((a) => a.member_id).filter(Boolean));

      const sessionRow = sessions.find((s) => s.id === sid);
      const dateRange = sessionRow?.starts_on
        ? `${sessionRow.starts_on}${sessionRow.ends_on ? ` to ${sessionRow.ends_on}` : ""}`
        : report.cover?.date_range || "";

      // Striking testimonies come from the course feedback form responses
      const feedbackTestimonies = (testimonies || [])
        .map((r) => {
          const a = r.answers || {};
          const body = String(a.testimony || "").trim();
          if (!body) return null;
          const name =
            [a.first_name, a.surname].filter(Boolean).join(" ").trim() ||
            [r.members?.first_name, r.members?.last_name].filter(Boolean).join(" ").trim();
          return { heading: DEFAULT_TESTIMONY_HEADING, body, name };
        })
        .filter(Boolean);


      setReport((prev) => ({
        ...prev,
        cover: {
          ...prev.cover,
          church_name: template?.church_name || currentTenant?.name || prev.cover.church_name,
          centre_name: template?.centre_name || prev.cover.centre_name,
          logo_url: template?.wofbi_logo_url || template?.crest_image_url || template?.logo_url || currentTenant?.logo_url || prev.cover.logo_url,
          course_title: course?.name || prev.cover.course_title,
          course_code: course?.course_code || prev.cover.course_code,
          edition: sessionRow?.name || prev.cover.edition,
          date_range: dateRange,
        },
        induction: { ...prev.induction, students: String(approved.length || regList.length) },
        class_attendance: String(attendees.size || prev.class_attendance || ""),
        stats_a: {
          ...prev.stats_a,
          water_baptised: String(waterBaptised),
          holy_ghost: String(holyGhost),
          new_birth: String(newBirth),
          testimonies: String(feedbackTestimonies.length),
        },
        stats_b: {
          ...prev.stats_b,
          forms_received: String(appCount || regList.length || 0),
          registered_confirmed: String(approved.length),
          completed: String(completed),
          at_graduation: prev.stats_b.at_graduation || String(completed),
          absentees: String(Math.max(0, (approved.length || regList.length) - (attendees.size || 0))),
        },
        nations: nations.length ? nations : prev.nations,
        courses: courseRows.length ? courseRows : prev.courses,
        student_feedback: studentFeedback.length ? studentFeedback : prev.student_feedback,
        qc: qcRows.length ? qcRows : prev.qc,
        honorarium_heading:
          prev.honorarium_heading ||
          [
            course?.name ? `${course.name} COURSE`.toUpperCase() : "",
            (template?.centre_name || prev.cover.centre_name || "").toUpperCase(),
          ]
            .filter(Boolean)
            .join(" – "),
        honorarium: honorarium.length ? honorarium : prev.honorarium,
        honorarium_matrix: { rate, rows: matrixRows.length ? matrixRows : prev.honorarium_matrix.rows },
        signoff: {
          name: prev.signoff?.name || "",
          title:
            prev.signoff?.title ||
            `RP, ${template?.church_name || currentTenant?.name || ""}`.trim(),
        },
        testimonies: feedbackTestimonies.length ? feedbackTestimonies : prev.testimonies,
      }));
      setDirty(true);
      toast({ title: "Report refreshed from live data", description: "Review and edit before saving." });
    } catch (e) {
      toast({ title: "Could not refresh", description: e.message, variant: "destructive" });
    } finally {
      setFilling(false);
    }
  }

  async function save(nextStatus = status) {
    if (!courseId || !tenantId) return;
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        course_id: courseId,
        session_id: sessionId === NO_SESSION ? null : sessionId,
        title: report.cover?.course_title || selectedCourse?.name || null,
        status: nextStatus,
        content: report,
      };
      let error;
      if (existing?.id) {
        ({ error } = await supabase.from("wofbi_course_reports")
          .update(payload).eq("id", existing.id).eq("tenant_id", tenantId));
      } else {
        ({ error } = await supabase.from("wofbi_course_reports").insert(payload));
      }
      if (error) throw error;
      setStatus(nextStatus);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["wofbi-course-report", tenantId, courseId, sessionId] });
      toast({ title: nextStatus === "final" ? "Report marked final" : "Report saved" });
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Course Final Report
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Generate an editable end-of-course report, pre-filled from registrations, attendance, ratings and QC checks.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 min-w-0">
              <Label className="text-xs">Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="text-xs">Session / edition</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SESSION}>All sessions</SelectItem>
                  {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {courseId && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant={status === "final" ? "default" : "secondary"} className="text-[10px]">
                {status === "final" ? "Final" : "Draft"}
              </Badge>
              {dirty && <span className="text-[11px] text-muted-foreground">Unsaved changes</span>}
              <div className="flex-1" />
              <Button size="sm" variant="outline" onClick={autofill} disabled={filling}>
                {filling ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                Refresh from data
              </Button>
              <Button size="sm" onClick={() => save()} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => save(status === "final" ? "draft" : "final")} disabled={saving}>
                {status === "final" ? "Reopen as draft" : "Mark final"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Preview
              </Button>
              <Button size="sm" variant="outline" onClick={() => printReport(reportForExport)}>
                <Printer className="h-3.5 w-3.5 mr-1" /> Print / PDF
              </Button>
              <Button size="sm" variant="outline" onClick={handleWordDownload}>
                <FileDown className="h-3.5 w-3.5 mr-1" /> Word
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-base">Report preview</DialogTitle>
          </DialogHeader>
          <iframe
            title="Course report preview"
            srcDoc={buildReportHtml(reportForExport)}
            className="w-full h-[75vh] border-0 bg-white"
          />
          <div className="flex flex-wrap gap-2 justify-end px-4 py-3 border-t">
            <Button size="sm" variant="outline" onClick={() => printReport(reportForExport)}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print / PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleWordDownload}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> Word
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {!courseId ? (
        <p className="text-sm text-muted-foreground">Select a course to build its report.</p>
      ) : loadingReport ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <Accordion type="multiple" defaultValue={["cover", "intro"]} className="space-y-2">
          <AccordionItem value="cover" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">Cover page</AccordionTrigger>
            <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
              <TextField label="Institute name" value={report.cover.institute_name} onChange={(v) => set("cover.institute_name", v)} />
              <TextField label="Church name" value={report.cover.church_name} onChange={(v) => set("cover.church_name", v)} />
              <TextField label="Learning centre" value={report.cover.centre_name} onChange={(v) => set("cover.centre_name", v)} />
              <TextField label="Course title" value={report.cover.course_title} onChange={(v) => set("cover.course_title", v)} />
              <TextField label="Course code" value={report.cover.course_code} onChange={(v) => set("cover.course_code", v)} />
              <TextField label="Edition" value={report.cover.edition} onChange={(v) => set("cover.edition", v)} />
              <TextField label="Date range" value={report.cover.date_range} onChange={(v) => set("cover.date_range", v)} />
              <TextField label="Logo URL" value={report.cover.logo_url} onChange={(v) => set("cover.logo_url", v)} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="intro" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">1. Introduction</AccordionTrigger>
            <AccordionContent className="pb-4">
              <AreaField label="Introduction" rows={7} value={report.introduction} onChange={(v) => set("introduction", v)} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faculty" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">2. Faculty</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs">Coordinating team (one per line)</Label>
                <LinesEditor value={report.faculty.coordinating} onChange={(v) => set("faculty.coordinating", v)} placeholder="Pst. Name - Role" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Volunteers (one per line)</Label>
                <LinesEditor value={report.faculty.volunteers} onChange={(v) => set("faculty.volunteers", v)} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="stats" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">3–5. Induction, attendance & statistics</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <TextField label="Induction date" value={report.induction.date} onChange={(v) => set("induction.date", v)} />
                <TextField label="Students at induction" value={report.induction.students} onChange={(v) => set("induction.students", v)} />
                <TextField label="Class attendance" value={report.class_attendance} onChange={(v) => set("class_attendance", v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField label="Water baptised" value={report.stats_a.water_baptised} onChange={(v) => set("stats_a.water_baptised", v)} />
                <TextField label="Holy Ghost baptised" value={report.stats_a.holy_ghost} onChange={(v) => set("stats_a.holy_ghost", v)} />
                <TextField label="New birth" value={report.stats_a.new_birth} onChange={(v) => set("stats_a.new_birth", v)} />
                <TextField label="Testimonies recorded" value={report.stats_a.testimonies} onChange={(v) => set("stats_a.testimonies", v)} />
                <TextField label="Registration forms received" value={report.stats_b.forms_received} onChange={(v) => set("stats_b.forms_received", v)} />
                <TextField label="Registered & confirmed" value={report.stats_b.registered_confirmed} onChange={(v) => set("stats_b.registered_confirmed", v)} />
                <TextField label="Completed courses & test" value={report.stats_b.completed} onChange={(v) => set("stats_b.completed", v)} />
                <TextField label="At graduation ceremony" value={report.stats_b.at_graduation} onChange={(v) => set("stats_b.at_graduation", v)} />
                <TextField label="Absentees" value={report.stats_b.absentees} onChange={(v) => set("stats_b.absentees", v)} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="nations" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">6. Nations representation</AccordionTrigger>
            <AccordionContent className="pb-4">
              <RowEditor rows={report.nations} onChange={(v) => set("nations", v)} addLabel="Add nation"
                columns={[{ key: "name", label: "Nation" }, { key: "count", label: "Number of students" }]} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="courses" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">7. Courses & lecturers</AccordionTrigger>
            <AccordionContent className="pb-4">
              <RowEditor rows={report.courses} onChange={(v) => set("courses", v)} addLabel="Add course"
                columns={[{ key: "course", label: "Course" }, { key: "code", label: "Code" }, { key: "lecturer", label: "Lecturer" }]} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="findings" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">8. General findings & observations</AccordionTrigger>
            <AccordionContent className="space-y-3 pb-4">
              {FINDING_FIELDS.map((f) => (
                <AreaField key={f.key} label={f.label} rows={3}
                  value={report.findings[f.key]} onChange={(v) => set(`findings.${f.key}`, v)} />
              ))}
              <AreaField label="Overall performance" rows={3} value={report.overall_performance} onChange={(v) => set("overall_performance", v)} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="testimonies" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">9. Striking testimonies</AccordionTrigger>
            <AccordionContent className="pb-4">
              <RowEditor rows={report.testimonies} onChange={(v) => set("testimonies", v)} addLabel="Add testimony"
                columns={[{ key: "heading", label: "Heading" }, { key: "name", label: "Student name" }, { key: "body", label: "Testimony", area: true }]} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="feedback" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">10. Student feedback on lecturers</AccordionTrigger>
            <AccordionContent className="pb-4">
              <RowEditor rows={report.student_feedback} onChange={(v) => set("student_feedback", v)} addLabel="Add lecturer"
                columns={[
                  { key: "lecturer", label: "Lecturer" }, { key: "course", label: "Course" },
                  { key: "qc_person", label: "QC personnel" }, { key: "qc_rating", label: "QC rating" },
                  { key: "student_rating", label: "Student average rating" },
                ]} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="qc" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">11. Quality control observations</AccordionTrigger>
            <AccordionContent className="pb-4">
              <RowEditor rows={report.qc} onChange={(v) => set("qc", v)} addLabel="Add QC entry"
                columns={[
                  { key: "lecturer", label: "Lecturer" }, { key: "course", label: "Course" },
                  { key: "qc_person", label: "QC personnel" }, { key: "observations", label: "General observations", area: true },
                ]} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="honorarium" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">12. Honorarium recommendation</AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <RowEditor rows={report.honorarium} onChange={(v) => set("honorarium", v)} addLabel="Add course"
                columns={[
                  { key: "course", label: "Course" }, { key: "code", label: "Code" },
                  { key: "lecturer", label: "Lecturer" }, { key: "type", label: "Type (Internal / External)" },
                  { key: "remarks", label: "Remarks" },
                ]} />
              <div className="space-y-2">
                <TextField label="Honorarium rate per course (£)" value={report.honorarium_matrix.rate}
                  onChange={(v) => set("honorarium_matrix.rate", v)} />
                <RowEditor rows={report.honorarium_matrix.rows} onChange={(v) => set("honorarium_matrix.rows", v)} addLabel="Add lecturer"
                  columns={[
                    { key: "lecturer", label: "Approved lecturer" }, { key: "courses", label: "No. of courses" },
                    { key: "amount", label: "Recommended honorarium" }, { key: "cos", label: "Signed COS / payroll" },
                  ]} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="next" className="border rounded-md px-3">
            <AccordionTrigger className="text-sm">13. Next session</AccordionTrigger>
            <AccordionContent className="pb-4">
              <AreaField label="Next session note" rows={3} value={report.next_session} onChange={(v) => set("next_session", v)} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
