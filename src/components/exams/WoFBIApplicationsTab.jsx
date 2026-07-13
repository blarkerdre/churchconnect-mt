import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Search, Download, Eye, CheckCircle2, XCircle, Trash2, BarChart3, X } from "lucide-react";

const STATUS_VARIANT = {
  submitted: "secondary",
  pending: "secondary",
  approved: "default",
  active: "default",
  rejected: "destructive",
};

const SOURCE_LABEL = {
  form: "Application form",
  direct: "Direct enrolment",
};

export default function WoFBIApplicationsTab() {
  const qc = useQueryClient();
  const { user, isTenantAdmin, isTenantOwner, isAdmin } = useAuth();
  const canDelete = isTenantAdmin || isTenantOwner || isAdmin;
  const { tenantId, scopeQuery } = useTenantQuery();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [answerFilters, setAnswerFilters] = useState([]); // [{ id, fieldId, value }]
  const [newFilterFieldId, setNewFilterFieldId] = useState("");
  const [newFilterValue, setNewFilterValue] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [detail, setDetail] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { ids: [], label: '' }
  const [showReport, setShowReport] = useState(false);

  const { data: form } = useQuery({
    queryKey: ["wofbi-application-form-fields", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("wofbi_application_forms")
        .select("fields, title")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return data;
    },
  });

  const { data: appRows = [], isLoading: appsLoading } = useQuery({
    queryKey: ["wofbi-applications", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("wofbi_applications")
          .select("*, course:exam_titles(id, name), member:members(id, first_name, last_name)")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { data: regRows = [], isLoading: regsLoading } = useQuery({
    queryKey: ["wofbi-direct-registrations", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("course_registrations")
          .select("id, member_id, course_id, status, registered_at, course:exam_titles(id, name), member:members(id, first_name, last_name, email, phone)")
          .order("registered_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = appsLoading || regsLoading;

  // Merge: application rows win over direct registrations for the same (member_id, course_id).
  const applications = useMemo(() => {
    const appKey = (a) => `${a.member_id || ""}|${a.course_id || ""}`;
    const appKeys = new Set(appRows.filter((a) => a.member_id && a.course_id).map(appKey));
    const formRows = appRows.map((a) => ({ ...a, source: "form" }));
    const syntheticRows = regRows
      .filter((r) => !(r.member_id && r.course_id && appKeys.has(`${r.member_id}|${r.course_id}`)))
      .map((r) => ({
        id: `reg:${r.id}`,
        registration_id: r.id,
        source: "direct",
        tenant_id: tenantId,
        member_id: r.member_id,
        course_id: r.course_id,
        first_name: r.member?.first_name || "",
        last_name: r.member?.last_name || "",
        email: r.member?.email || "",
        phone: r.member?.phone || "",
        course: r.course || null,
        member: r.member || null,
        status: r.status,
        answers: {},
        created_at: r.registered_at,
      }));
    return [...formRows, ...syntheticRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [appRows, regRows, tenantId]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }) => {
      const app = applications.find((a) => a.id === id);
      if (!app) throw new Error("Row not found");

      // Direct registration path — update course_registrations status only.
      if (app.source === "direct") {
        const regStatus = status === "approved" ? "approved" : status === "rejected" ? "rejected" : status;
        const patch = { status: regStatus };
        if (regStatus === "approved") {
          patch.approved_at = new Date().toISOString();
          patch.approved_by = user?.id || null;
        }
        const { error } = await supabase
          .from("course_registrations")
          .update(patch)
          .eq("id", app.registration_id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        await logAudit(
          "course_registration.status_changed",
          "course_registrations",
          app.registration_id,
          { status: regStatus, via: "bible_school_applications_tab" },
          tenantId
        );
        return { status, enrolled: false, alreadyEnrolled: false, unlinked: false, source: "direct" };
      }

      // Form application path (original behaviour).
      const { error } = await supabase
        .from("wofbi_applications")
        .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;

      let enrolled = false;
      let alreadyEnrolled = false;
      let unlinked = false;

      if (status === "approved") {
        if (app.member_id && app.course_id) {
          const { data: existing } = await supabase
            .from("course_registrations")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("member_id", app.member_id)
            .eq("course_id", app.course_id)
            .maybeSingle();
          if (existing) {
            alreadyEnrolled = true;
          } else {
            const { error: insErr } = await supabase.from("course_registrations").insert({
              tenant_id: tenantId,
              member_id: app.member_id,
              course_id: app.course_id,
              status: "active",
              registered_at: new Date().toISOString(),
            });
            if (insErr) throw insErr;
            enrolled = true;
          }
        } else if (!app.member_id) {
          unlinked = true;
        }
        await logAudit(
          "wofbi_application.approved",
          "wofbi_applications",
          id,
          { member_id: app.member_id || null, course_id: app.course_id || null, enrolled, already_enrolled: alreadyEnrolled, unlinked },
          tenantId
        );
      }

      return { status, enrolled, alreadyEnrolled, unlinked, source: "form" };
    },
    onSuccess: (res, variables) => {
      qc.invalidateQueries({ queryKey: ["wofbi-applications", tenantId] });
      qc.invalidateQueries({ queryKey: ["wofbi-direct-registrations", tenantId] });
      qc.invalidateQueries({ queryKey: ["course-registrations"] });
      if (res.status === "approved") {
        if (res.source === "direct") {
          toast({ title: "Registration approved" });
        } else if (res.enrolled) {
          toast({ title: "Applicant approved and enrolled", description: "A course registration has been created." });
        } else if (res.alreadyEnrolled) {
          toast({ title: "Approved", description: "Applicant was already enrolled in this course." });
        } else if (res.unlinked) {
          toast({ title: "Approved", description: "Link this applicant to a member record to enrol them into the course." });
        } else {
          toast({ title: "Application approved" });
        }
        // For form applications, silently provision an account + email a magic link so the applicant can write the exam without signing up.
        if (res.source === "form" && variables?.id) {
          provisionExamAccount.mutate({ id: variables.id, silent: true });
        }
      } else {
        toast({ title: res.source === "direct" ? "Registration updated" : "Application updated" });
      }
      setDetail(null);
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const provisionExamAccount = useMutation({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase.functions.invoke("provision-exam-account", {
        body: { application_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, vars) => {
      if (!vars?.silent) toast({ title: "Exam link sent", description: "The applicant has been emailed a one-click sign-in link." });
    },
    onError: (e, vars) => {
      toast({
        title: vars?.silent ? "Approved — but exam link failed" : "Failed to send exam link",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const deleteApplications = useMutation({
    mutationFn: async (ids) => {
      const toDelete = applications.filter((a) => ids.includes(a.id));
      const formRows = toDelete.filter((a) => a.source !== "direct");
      const directRows = toDelete.filter((a) => a.source === "direct");

      // Form applications: cascade for linked, plain delete for unlinked (original behaviour).
      const linked = formRows.filter((a) => a.member_id);
      const unlinked = formRows.filter((a) => !a.member_id);

      for (const a of linked) {
        const { error } = await supabase.rpc("cascade_delete_bible_school_records", {
          _member_id: a.member_id,
          _course_id: a.course_id || null,
        });
        if (error) throw error;
      }

      if (unlinked.length > 0) {
        const { error } = await supabase
          .from("wofbi_applications")
          .delete()
          .in("id", unlinked.map((a) => a.id))
          .eq("tenant_id", tenantId);
        if (error) throw error;
      }

      // Direct registrations: cascade Bible School records via the same RPC.
      for (const a of directRows) {
        if (a.member_id) {
          const { error } = await supabase.rpc("cascade_delete_bible_school_records", {
            _member_id: a.member_id,
            _course_id: a.course_id || null,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("course_registrations")
            .delete()
            .eq("id", a.registration_id)
            .eq("tenant_id", tenantId);
          if (error) throw error;
        }
      }

      await Promise.all(
        toDelete.map((a) =>
          logAudit(
            a.source === "direct" ? "course_registration.deleted" : "wofbi_application.deleted",
            a.source === "direct" ? "course_registrations" : "wofbi_applications",
            a.source === "direct" ? a.registration_id : a.id,
            { name: `${a.first_name} ${a.last_name}`, email: a.email, course: a.course?.name || null, source: a.source, cascaded: !!a.member_id },
            tenantId
          )
        )
      );
      return ids.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["wofbi-applications", tenantId] });
      qc.invalidateQueries({ queryKey: ["wofbi-direct-registrations", tenantId] });
      qc.invalidateQueries({ queryKey: ["course-registrations"] });
      toast({
        title: count > 1 ? `Deleted ${count} entries` : "Entry deleted",
        description: "All linked Bible School records (registration, exam attempts, results, certificate, ratings) were also removed.",
      });
      setSelectedIds(new Set());
      setConfirmDelete(null);
      setDetail(null);
    },
    onError: (e) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const courseOptions = useMemo(() => {
    const m = new Map();
    applications.forEach((a) => {
      if (a.course?.id) m.set(a.course.id, a.course.name);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [applications]);

  const filterableFields = useMemo(
    () => (form?.fields || []).filter((f) => f.type !== "section_heading"),
    [form]
  );

  const getFieldMeta = (fieldId) => filterableFields.find((f) => f.id === fieldId);

  const statusMatches = (rowStatus, filter) => {
    if (filter === "all") return true;
    if (filter === "approved") return rowStatus === "approved" || rowStatus === "active";
    if (filter === "submitted") return rowStatus === "submitted" || rowStatus === "pending";
    return rowStatus === filter;
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 : null;
    return applications.filter((a) => {
      if (!statusMatches(a.status, statusFilter)) return false;
      if (courseFilter !== "all" && a.course?.id !== courseFilter) return false;
      if (sourceFilter !== "all" && a.source !== sourceFilter) return false;
      if (from || to) {
        const t = new Date(a.created_at).getTime();
        if (from && t < from) return false;
        if (to && t >= to) return false;
      }
      if (s) {
        const hay = `${a.first_name} ${a.last_name} ${a.email || ""} ${a.course?.name || ""} ${a.status || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      for (const af of answerFilters) {
        const field = getFieldMeta(af.fieldId);
        if (!field) continue;
        if (a.source === "direct") return false; // direct rows have no answers
        const v = a.answers?.[af.fieldId];
        if (field.type === "checkbox") {
          const want = af.value === "true";
          if (!!v !== want) return false;
        } else if (field.type === "select" || field.type === "radio" || field.type === "yes_no") {
          if ((v ?? "") !== af.value) return false;
        } else {
          const sv = String(v ?? "").toLowerCase();
          if (!sv.includes(String(af.value).toLowerCase())) return false;
        }
      }
      return true;
    });
  }, [applications, q, statusFilter, courseFilter, sourceFilter, dateFrom, dateTo, answerFilters, filterableFields]);

  const hasFilters =
    statusFilter !== "all" ||
    courseFilter !== "all" ||
    sourceFilter !== "all" ||
    dateFrom ||
    dateTo ||
    q ||
    answerFilters.length > 0;

  const clearFilters = () => {
    setQ("");
    setStatusFilter("all");
    setCourseFilter("all");
    setSourceFilter("all");
    setDateFrom("");
    setDateTo("");
    setAnswerFilters([]);
    setSelectedIds(new Set());
  };

  const newFilterField = getFieldMeta(newFilterFieldId);
  const newFilterIsChoice =
    newFilterField &&
    (newFilterField.type === "select" || newFilterField.type === "radio" || newFilterField.type === "yes_no" || newFilterField.type === "checkbox");
  const newFilterOptions = !newFilterField
    ? []
    : newFilterField.type === "checkbox"
    ? [{ v: "true", label: "Yes" }, { v: "false", label: "No" }]
    : newFilterField.type === "yes_no"
    ? [{ v: "Yes", label: "Yes" }, { v: "No", label: "No" }]
    : (newFilterField.options || []).map((o) => ({ v: o, label: o }));

  const addAnswerFilter = () => {
    if (!newFilterField || !newFilterValue) return;
    setAnswerFilters((prev) => [
      ...prev,
      { id: `${newFilterFieldId}-${Date.now()}`, fieldId: newFilterFieldId, value: newFilterValue },
    ]);
    setNewFilterFieldId("");
    setNewFilterValue("");
    setSelectedIds(new Set());
  };

  const removeAnswerFilter = (id) => {
    setAnswerFilters((prev) => prev.filter((f) => f.id !== id));
    setSelectedIds(new Set());
  };

  const formatAnswerValue = (field, value) => {
    if (!field) return value;
    if (field.type === "checkbox") return value === "true" ? "Yes" : "No";
    return value;
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((a) => next.delete(a.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((a) => next.add(a.id));
      return next;
    });
  };

  const normStatus = (s) => (s === "active" ? "approved" : s === "pending" ? "submitted" : s);

  const report = useMemo(() => {
    const total = filtered.length;
    const byStatus = { submitted: 0, approved: 0, rejected: 0 };
    const bySource = { form: 0, direct: 0 };
    const byCourse = new Map();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    let thisMonth = 0, lastMonth = 0;
    filtered.forEach((a) => {
      const st = normStatus(a.status);
      byStatus[st] = (byStatus[st] || 0) + 1;
      bySource[a.source] = (bySource[a.source] || 0) + 1;
      const key = a.course?.name || "—";
      byCourse.set(key, (byCourse.get(key) || 0) + 1);
      const t = new Date(a.created_at).getTime();
      if (t >= monthStart) thisMonth++;
      else if (t >= lastMonthStart) lastMonth++;
    });
    const topCourses = Array.from(byCourse.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return { total, byStatus, bySource, topCourses, thisMonth, lastMonth };
  }, [filtered]);

  const exportCsv = () => {
    const fields = form?.fields || [];
    const headers = [
      "Submitted",
      "Source",
      "First name",
      "Last name",
      "Email",
      "Phone",
      "Course",
      "Status",
      ...fields.filter((f) => f.type !== "section_heading").map((f) => f.label),
    ];
    const rows = filtered.map((a) => [
      new Date(a.created_at).toISOString(),
      SOURCE_LABEL[a.source] || a.source,
      a.first_name,
      a.last_name,
      a.email,
      a.phone || "",
      a.course?.name || "",
      a.status,
      ...fields.filter((f) => f.type !== "section_heading").map((f) => {
        const v = a.answers?.[f.id];
        if (v === true) return "Yes";
        if (v === false) return "No";
        return v ?? "";
      }),
    ]);
    const suffix = answerFilters.length > 0 ? "-filtered" : "";
    downloadCsv([headers, ...rows], `bible-school-applications${suffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportReport = () => {
    const rows = [
      ["Metric", "Value"],
      ["Total (filtered)", report.total],
      ["Submitted", report.byStatus.submitted || 0],
      ["Approved", report.byStatus.approved || 0],
      ["Rejected", report.byStatus.rejected || 0],
      ["Application form", report.bySource.form || 0],
      ["Direct enrolment", report.bySource.direct || 0],
      ["This month", report.thisMonth],
      ["Last month", report.lastMonth],
      [],
      ["Course", "Applications"],
      ...report.topCourses.map(([n, c]) => [n, c]),
    ];
    const suffix = answerFilters.length > 0 ? "-filtered" : "";
    downloadCsv(rows, `bible-school-report${suffix}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const answerFields = (form?.fields || []).filter((f) => f.type !== "section_heading");

  const pct = (n) => (report.total ? Math.round((n / report.total) * 100) : 0);

  const isApprovedStatus = (s) => s === "approved" || s === "active";
  const isRejectedStatus = (s) => s === "rejected";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base">Bible School Applications ({applications.length})</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowReport((s) => !s)}>
            <BarChart3 className="h-4 w-4" /> {showReport ? "Hide" : "Report"}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showReport && (
          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Report (filtered results)</h3>
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={exportReport} disabled={report.total === 0}>
                <Download className="h-3.5 w-3.5" /> Export report
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Total" value={report.total} />
              <Stat label="Submitted" value={`${report.byStatus.submitted || 0} (${pct(report.byStatus.submitted || 0)}%)`} />
              <Stat label="Approved" value={`${report.byStatus.approved || 0} (${pct(report.byStatus.approved || 0)}%)`} />
              <Stat label="Rejected" value={`${report.byStatus.rejected || 0} (${pct(report.byStatus.rejected || 0)}%)`} />
              <Stat label="Application form" value={report.bySource.form || 0} />
              <Stat label="Direct enrolment" value={report.bySource.direct || 0} />
              <Stat label="This month" value={report.thisMonth} />
              <Stat label="Last month" value={report.lastMonth} />
            </div>
            {report.topCourses.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-1">Top courses</div>
                <div className="border rounded-md divide-y bg-background">
                  {report.topCourses.map(([name, count]) => (
                    <div key={name} className="flex justify-between px-2 py-1 text-sm">
                      <span className="truncate">{name}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, course, status" className="pl-8" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="submitted">Submitted / Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All courses</SelectItem>
                {courseOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="form">Application form</SelectItem>
                <SelectItem value="direct">Direct enrolment</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" aria-label="From date" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" aria-label="To date" />
          </div>

          {filterableFields.length > 0 && (
            <div className="rounded-md border p-2 space-y-2 bg-muted/20">
              <div className="text-xs font-semibold text-muted-foreground">Filter by form answers (application-form entries only)</div>
              {answerFilters.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {answerFilters.map((af) => {
                    const field = getFieldMeta(af.fieldId);
                    return (
                      <Badge key={af.id} variant="secondary" className="gap-1 pr-1">
                        <span className="text-xs">
                          {field?.label || "Field"}: {formatAnswerValue(field, af.value)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAnswerFilter(af.id)}
                          className="ml-0.5 rounded hover:bg-background/60 p-0.5"
                          aria-label="Remove filter"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-2">
                <Select
                  value={newFilterFieldId}
                  onValueChange={(v) => { setNewFilterFieldId(v); setNewFilterValue(""); }}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select field..." /></SelectTrigger>
                  <SelectContent>
                    {filterableFields.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newFilterIsChoice ? (
                  <Select value={newFilterValue} onValueChange={setNewFilterValue} disabled={!newFilterField}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Value..." /></SelectTrigger>
                    <SelectContent>
                      {newFilterOptions.map((o) => (
                        <SelectItem key={o.v} value={o.v}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-9"
                    value={newFilterValue}
                    onChange={(e) => setNewFilterValue(e.target.value)}
                    placeholder={newFilterField ? "Contains..." : "Pick a field first"}
                    disabled={!newFilterField}
                  />
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={addAnswerFilter}
                  disabled={!newFilterField || !newFilterValue}
                >
                  Add filter
                </Button>
              </div>
            </div>
          )}

          {hasFilters && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{filtered.length} of {applications.length} shown</span>
              <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={clearFilters}>
                <X className="h-3 w-3" /> Clear filters
              </Button>
            </div>
          )}
        </div>


        {canDelete && selectedIds.size > 0 && (
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <span className="text-sm">{selectedIds.size} selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                onClick={() => setConfirmDelete({ ids: Array.from(selectedIds), label: `${selectedIds.size} entries` })}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete selected
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {applications.length === 0 ? "No applications yet." : "No applications match the current filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {canDelete && (
                    <TableHead className="w-8">
                      <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                    </TableHead>
                  )}
                  <TableHead>Submitted</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id}>
                    {canDelete && (
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(a.id)}
                          onCheckedChange={() => toggleSelect(a.id)}
                          aria-label={`Select ${a.first_name} ${a.last_name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-xs">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{a.first_name} {a.last_name}</TableCell>
                    <TableCell className="text-xs">{a.email}</TableCell>
                    <TableCell className="text-xs">{a.course?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={a.source === "direct" ? "outline" : "secondary"} className="text-[10px]">
                        {SOURCE_LABEL[a.source]}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[a.status] || "secondary"} className="capitalize">{a.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setDetail(a)} className="gap-1.5">
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        {!isApprovedStatus(a.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary hover:text-primary"
                            onClick={() => updateStatus.mutate({ id: a.id, status: "approved" })}
                            disabled={updateStatus.isPending}
                            aria-label="Approve"
                            title="Approve"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {!isRejectedStatus(a.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => updateStatus.mutate({ id: a.id, status: "rejected" })}
                            disabled={updateStatus.isPending}
                            aria-label="Reject"
                            title="Reject"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setConfirmDelete({ ids: [a.id], label: `${a.first_name} ${a.last_name}` })}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail?.source === "direct" ? "Direct enrolment" : "Application"} — {detail?.first_name} {detail?.last_name}
            </DialogTitle>
            <DialogDescription>
              {detail?.source === "direct" ? "Registered" : "Submitted"} {detail && new Date(detail.created_at).toLocaleString()} · {detail?.email || "—"} · Course: {detail?.course?.name || "—"}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">Status:</span>
                <Badge variant={STATUS_VARIANT[detail.status] || "secondary"} className="capitalize">{detail.status}</Badge>
                <Badge variant={detail.source === "direct" ? "outline" : "secondary"} className="text-[10px]">
                  {SOURCE_LABEL[detail.source]}
                </Badge>
              </div>
              {detail.source === "direct" ? (
                <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/20">
                  <p className="text-muted-foreground">
                    This entry was created directly as a course registration (not via the Bible School application form),
                    so no application answers were captured.
                  </p>
                  {detail.phone && <p><span className="text-muted-foreground">Phone:</span> {detail.phone}</p>}
                </div>
              ) : (
                <div className="border rounded-md divide-y">
                  {(form?.fields || []).map((f) => {
                    if (f.type === "section_heading") {
                      return (
                        <div key={f.id} className="p-2 bg-muted/50 text-xs font-semibold uppercase tracking-wide text-primary">
                          {f.label}
                        </div>
                      );
                    }
                    const v = detail.answers?.[f.id];
                    const display = v === true ? "Yes" : v === false ? "No" : (v ?? "—");
                    return (
                      <div key={f.id} className="p-2 grid grid-cols-3 gap-2 text-sm">
                        <div className="text-muted-foreground col-span-1">{f.label}</div>
                        <div className="col-span-2 whitespace-pre-wrap break-words">{display || "—"}</div>
                      </div>
                    );
                  })}
                  {answerFields.length === 0 && (
                    <div className="p-2 text-sm text-muted-foreground">No detailed answers captured.</div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            {detail && !isApprovedStatus(detail.status) && (
              <Button className="gap-1.5" onClick={() => updateStatus.mutate({ id: detail.id, status: "approved" })}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            )}
            {detail && !isRejectedStatus(detail.status) && (
              <Button variant="destructive" className="gap-1.5" onClick={() => updateStatus.mutate({ id: detail.id, status: "rejected" })}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            )}
            {canDelete && detail && (
              <Button
                variant="outline"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete({ ids: [detail.id], label: `${detail.first_name} ${detail.last_name}` })}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete entr{confirmDelete?.ids.length > 1 ? "ies" : "y"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{confirmDelete?.label}</strong> and all linked Bible School records (course registration, exam attempts, results, certificate and lecturer ratings). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteApplications.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteApplications.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmDelete) deleteApplications.mutate(confirmDelete.ids);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteApplications.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function downloadCsv(rows, filename) {
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => (r || []).map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
