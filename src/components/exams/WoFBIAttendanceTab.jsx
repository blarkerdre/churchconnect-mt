import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, QrCode, Trash2, Download, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, Pencil, Star } from "lucide-react";
import WoFBIPersistentQRDialog from "./WoFBIPersistentQRDialog";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";
import PasswordConfirmDialog from "@/components/shared/PasswordConfirmDialog";
import { useTenant } from "@/contexts/TenantContext";
import { downloadRosterCsv, printRosterPdf } from "@/lib/attendance-roster";
import { useExamSessionFilter, EXAM_SESSION_ALL } from "@/contexts/ExamSessionFilterContext";

function pct(num, den) {
  if (!den) return "0%";
  return `${Math.round((num / den) * 100)}%`;
}

function fmtDuration(mins) {
  if (mins == null || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function fmtLocal(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Punctuality: auto score from attendance mix (present=100, late=50, absent=0)
function punctualityGrade(score) {
  if (score >= 90) return { label: "Excellent", cls: "bg-green-100 text-green-800" };
  if (score >= 70) return { label: "Good", cls: "bg-emerald-100 text-emerald-800" };
  if (score >= 50) return { label: "Fair", cls: "bg-amber-100 text-amber-800" };
  return { label: "Poor", cls: "bg-red-100 text-red-800" };
}

// Arrival position helpers (1st, 2nd, 3rd ...)
function ordinal(n) {
  if (n == null || !isFinite(n)) return "—";
  const i = Math.round(n);
  const mod100 = i % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${i}th`;
  switch (i % 10) {
    case 1: return `${i}st`;
    case 2: return `${i}nd`;
    case 3: return `${i}rd`;
    default: return `${i}th`;
  }
}

function positionCls(pos) {
  if (pos === 1) return "bg-amber-100 text-amber-900 border border-amber-300";
  if (pos === 2) return "bg-slate-200 text-slate-800 border border-slate-300";
  if (pos === 3) return "bg-orange-100 text-orange-900 border border-orange-300";
  return "bg-muted text-muted-foreground";
}

function PositionBadge({ pos }) {
  if (!pos) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${positionCls(pos)}`}>
      {ordinal(pos)}
    </span>
  );
}

// Builds Map<record_id, arrival position within its session>; ties share a position
function buildPositionMap(records) {
  const bySession = new Map();
  for (const r of records) {
    if (!r.checked_in_at) continue;
    if (!bySession.has(r.session_id)) bySession.set(r.session_id, []);
    bySession.get(r.session_id).push(r);
  }
  const map = new Map();
  for (const list of bySession.values()) {
    list.sort((a, b) => new Date(a.checked_in_at) - new Date(b.checked_in_at));
    let pos = 0;
    let prev = null;
    list.forEach((r, idx) => {
      const t = new Date(r.checked_in_at).getTime();
      if (prev === null || t !== prev) { pos = idx + 1; prev = t; }
      map.set(r.id, pos);
    });
  }
  return map;
}



function StarRating({ value, onChange, disabled }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(value === n ? null : n)}
          className="p-0.5 disabled:opacity-50"
        >
          <Star className={`h-4 w-4 ${value >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}


export default function WoFBIAttendanceTab() {
  const confirmDelete = useConfirmDelete();
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { currentTenant } = useTenant();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editSession, setEditSession] = useState(null); // session being edited
  const [qrOpen, setQrOpen] = useState(false);
  const [rosterSession, setRosterSession] = useState(null);
  const [expandedStudents, setExpandedStudents] = useState({});
  const [editRecord, setEditRecord] = useState(null); // { record, session, registration }
  const [editForm, setEditForm] = useState({ status: "present", checked_in_at: "", checked_out_at: "", punctuality_rating: null, punctuality_note: "" });
  const [rosterExportOpen, setRosterExportOpen] = useState(false);
  const [timeOutConfirm, setTimeOutConfirm] = useState(null);
  const [pendingRosterEdit, setPendingRosterEdit] = useState(null); // { payload, description }

  const [rosterExportScope, setRosterExportScope] = useState("summary"); // "summary" | session id
  const [rosterExporting, setRosterExporting] = useState(false);

  const emptySessionForm = () => ({
    title: "",
    session_date: new Date().toISOString().slice(0, 10),
    late_after: "",
    subject_id: "",
    notes: "",
    scheduled_open_at: "",
    scheduled_close_at: "",
    status: "open",
  });

  const [form, setForm] = useState(emptySessionForm);


  const { data: courses = [] } = useQuery({
    queryKey: ["wofbi-att-courses", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("exam_titles").select("id, name, course_code").order("name")
      );
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-select first course
  React.useEffect(() => {
    if (!selectedCourseId && courses.length) setSelectedCourseId(courses[0].id);
  }, [courses, selectedCourseId]);

  const { data: subjects = [] } = useQuery({
    queryKey: ["wofbi-att-subjects", tenantId, selectedCourseId],
    enabled: !!tenantId && !!selectedCourseId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("exam_subjects").select("id, name").eq("course_id", selectedCourseId).order("name")
      );
      if (error) throw error;
      return data || [];
    },
  });

  const { sessionId: editionId, sessionName: editionName, sessionMap, applySession, isAll: isAllEditions, isUnassigned, setSessionId: setEditionId } = useExamSessionFilter();
  const pinnedEditionId = !isAllEditions && !isUnassigned ? editionId : null;
  const pinnedEdition = pinnedEditionId ? sessionMap[pinnedEditionId] : null;

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["wofbi-att-sessions", tenantId, selectedCourseId, editionId],
    enabled: !!tenantId && !!selectedCourseId,
    queryFn: async () => {
      const { data, error } = await applySession(
        scopeQuery(
          supabase
            .from("wofbi_attendance_sessions")
            .select("*, edition:exam_sessions(id, name)")
            .eq("course_id", selectedCourseId)
        )
      ).order("session_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });


  // Counts of records per session for the sessions list
  const { data: recordsBySession = {} } = useQuery({
    queryKey: ["wofbi-att-record-counts", tenantId, selectedCourseId, sessions.map((s) => s.id).join(",")],
    enabled: !!tenantId && sessions.length > 0,
    queryFn: async () => {
      const ids = sessions.map((s) => s.id);
      const { data, error } = await supabase
        .from("wofbi_attendance_records")
        .select("session_id, status")
        .eq("tenant_id", tenantId)
        .in("session_id", ids);
      if (error) throw error;
      const map = {};
      for (const r of data || []) {
        if (!map[r.session_id]) map[r.session_id] = { present: 0, late: 0 };
        if (r.status === "late") map[r.session_id].late += 1;
        else map[r.session_id].present += 1;
      }
      return map;
    },
  });

  // Roster: approved/enrolled registrants of the course
  const { data: roster = [] } = useQuery({
    queryKey: ["wofbi-att-roster", tenantId, selectedCourseId],
    enabled: !!tenantId && !!selectedCourseId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("course_registrations")
          .select("id, member_id, student_number, status, members:member_id(id, first_name, last_name)")
          .eq("course_id", selectedCourseId)
          .in("status", ["approved", "enrolled", "active", "completed"])
      );
      if (error) throw error;
      return data || [];
    },
  });

  // All records across sessions for the % report
  const { data: allRecords = [] } = useQuery({
    queryKey: ["wofbi-att-all-records", tenantId, selectedCourseId, sessions.map((s) => s.id).join(",")],
    enabled: !!tenantId && sessions.length > 0,
    queryFn: async () => {
      const ids = sessions.map((s) => s.id);
      const { data, error } = await supabase
        .from("wofbi_attendance_records")
        .select("id, session_id, registration_id, member_id, status, checked_in_at, checked_out_at, duration_minutes, punctuality_rating, punctuality_note")
        .eq("tenant_id", tenantId)
        .in("session_id", ids);
      if (error) throw error;
      return data || [];
    },
  });

  // Records for currently open roster panel
  const { data: rosterRecords = [] } = useQuery({
    queryKey: ["wofbi-att-roster-records", rosterSession?.id, tenantId],
    enabled: !!rosterSession?.id && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wofbi_attendance_records")
        .select("*")
        .eq("session_id", rosterSession.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data || [];
    },
  });

  const createSession = useMutation({
    mutationFn: async (payload) => {
      const openAt = payload.scheduled_open_at ? new Date(payload.scheduled_open_at).toISOString() : null;
      const closeAt = payload.scheduled_close_at ? new Date(payload.scheduled_close_at).toISOString() : null;
      if (openAt && closeAt && closeAt <= openAt) throw new Error("Auto-close time must be after the auto-open time");
      // If it is scheduled to open later, start it closed
      const startsClosed = !!openAt && new Date(openAt) > new Date();
      const { error } = await supabase.from("wofbi_attendance_sessions").insert(
        withTenant({
          course_id: selectedCourseId,
          ...(pinnedEditionId ? { session_id: pinnedEditionId } : {}),
          subject_id: payload.subject_id || null,
          title: payload.title,
          session_date: payload.session_date,
          late_after: payload.late_after || null,
          notes: payload.notes || null,
          status: startsClosed ? "closed" : "open",
          scheduled_open_at: openAt,
          scheduled_close_at: closeAt,
          created_by: user?.id || null,
        })
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Attendance session created" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] });
      setNewOpen(false);
      setForm(emptySessionForm());
    },
    onError: (e) => toast({ title: "Failed to create session", description: e.message, variant: "destructive" }),
  });

  const openSessionEdit = (s) => {
    const toLocal = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };
    setForm({
      title: s.title || "",
      session_date: s.session_date || new Date().toISOString().slice(0, 10),
      late_after: s.late_after ? String(s.late_after).slice(0, 5) : "",
      subject_id: s.subject_id || "",
      notes: s.notes || "",
      scheduled_open_at: toLocal(s.scheduled_open_at),
      scheduled_close_at: toLocal(s.scheduled_close_at),
      status: s.status || "open",
    });
    setEditSession(s);
  };

  const updateSession = useMutation({
    mutationFn: async (payload) => {
      const openAt = payload.scheduled_open_at ? new Date(payload.scheduled_open_at).toISOString() : null;
      const closeAt = payload.scheduled_close_at ? new Date(payload.scheduled_close_at).toISOString() : null;
      if (openAt && closeAt && closeAt <= openAt) throw new Error("Auto-close time must be after the auto-open time");
      const isClosed = payload.status === "closed";
      const { error } = await supabase
        .from("wofbi_attendance_sessions")
        .update({
          ...(pinnedEditionId ? { session_id: pinnedEditionId } : {}),
          subject_id: payload.subject_id || null,
          title: payload.title,
          session_date: payload.session_date,
          late_after: payload.late_after || null,
          notes: payload.notes || null,
          status: isClosed ? "closed" : "open",
          scheduled_open_at: isClosed ? null : openAt,
          scheduled_close_at: isClosed ? null : closeAt,
        })
        .eq("id", editSession.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Session updated" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-record-counts"] });
      setEditSession(null);
      setForm(emptySessionForm());
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteSession = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("wofbi_attendance_sessions").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Session deleted" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] });
    },
    onError: (e) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const closeSession = useMutation({
    mutationFn: async (id) => {
      // Manual close overrides any schedule
      const { error } = await supabase
        .from("wofbi_attendance_sessions")
        .update({ status: "closed", scheduled_open_at: null, scheduled_close_at: null })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Session closed" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] });
    },
    onError: (e) => toast({ title: "Close failed", description: e.message, variant: "destructive" }),
  });

  const reopenSession = useMutation({
    mutationFn: async (id) => {
      // Manual reopen overrides any schedule
      const { error } = await supabase
        .from("wofbi_attendance_sessions")
        .update({ status: "open", scheduled_open_at: null, scheduled_close_at: null })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Session reopened" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-sessions"] });
    },
    onError: (e) => toast({ title: "Reopen failed", description: e.message, variant: "destructive" }),
  });

  const requestRosterEdit = (payload, registration, actionLabel) => {
    const name = `${registration?.members?.first_name || ""} ${registration?.members?.last_name || ""}`.trim() || "this student";
    setPendingRosterEdit({
      payload,
      description: `You are about to ${actionLabel} for ${name}. Re-enter your password to confirm this attendance change.`,
    });
  };


  const markStatus = useMutation({
    mutationFn: async ({ registration, status, action, rating }) => {
      if (!rosterSession) throw new Error("No session");
      const existing = rosterRecords.find((r) => r.registration_id === registration.id);

      // Time-out actions
      if (action === "set_time_out") {
        if (!existing) throw new Error("Set a time-in first");
        const now = new Date();
        const inAt = existing.checked_in_at ? new Date(existing.checked_in_at) : now;
        const duration = Math.max(0, Math.round((now - inAt) / 60000));
        const { error } = await supabase
          .from("wofbi_attendance_records")
          .update({ checked_out_at: now.toISOString(), duration_minutes: duration })
          .eq("id", existing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        return;
      }
      if (action === "clear_time_out") {
        if (!existing) return;
        const { error } = await supabase
          .from("wofbi_attendance_records")
          .update({ checked_out_at: null, duration_minutes: null })
          .eq("id", existing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        return;
      }
      if (action === "set_rating") {
        if (existing) {
          const { error } = await supabase
            .from("wofbi_attendance_records")
            .update({ punctuality_rating: rating })
            .eq("id", existing.id)
            .eq("tenant_id", tenantId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("wofbi_attendance_records").insert(
            withTenant({
              session_id: rosterSession.id,
              registration_id: registration.id,
              member_id: registration.member_id,
              status: "present",
              checked_in_at: new Date().toISOString(),
              punctuality_rating: rating,
              source: "manual",
            })
          );
          if (error) throw error;
        }
        return;
      }



      if (status === "absent") {
        if (existing) {
          const { error } = await supabase
            .from("wofbi_attendance_records")
            .delete()
            .eq("id", existing.id)
            .eq("tenant_id", tenantId);
          if (error) throw error;
        }
        return;
      }
      if (existing) {
        const { error } = await supabase
          .from("wofbi_attendance_records")
          .update({ status, checked_in_at: existing.checked_in_at || new Date().toISOString() })
          .eq("id", existing.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wofbi_attendance_records").insert(
          withTenant({
            session_id: rosterSession.id,
            registration_id: registration.id,
            member_id: registration.member_id,
            status,
            checked_in_at: new Date().toISOString(),
            source: "manual",
          })
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wofbi-att-roster-records"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-record-counts"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-all-records"] });
    },
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editRecord) throw new Error("No record");
      const { session, registration, record } = editRecord;
      const parse = (v) => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? undefined : d;
      };
      const inAt = parse(editForm.checked_in_at);
      const outAt = parse(editForm.checked_out_at);
      if (editForm.status === "absent") {
        if (record?.id) {
          const { error } = await supabase
            .from("wofbi_attendance_records")
            .delete()
            .eq("id", record.id)
            .eq("tenant_id", tenantId);
          if (error) throw error;
        }
        return;
      }
      if (inAt === undefined) throw new Error("Time in is not a valid date and time");
      if (outAt === undefined) throw new Error("Time out is not a valid date and time");
      if (!inAt) throw new Error("Time in is required");
      if (outAt && outAt < inAt) throw new Error("Time out must be after time in");
      const duration = outAt ? Math.max(0, Math.round((outAt - inAt) / 60000)) : null;
      if (record?.id) {
        const { error } = await supabase
          .from("wofbi_attendance_records")
          .update({
            status: editForm.status,
            checked_in_at: inAt.toISOString(),
            checked_out_at: outAt ? outAt.toISOString() : null,
            duration_minutes: duration,
            punctuality_rating: editForm.punctuality_rating || null,
            punctuality_note: editForm.punctuality_note || null,
          })
          .eq("id", record.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wofbi_attendance_records").insert(
          withTenant({
            session_id: session.id,
            registration_id: registration.id,
            member_id: registration.member_id,
            status: editForm.status,
            checked_in_at: inAt.toISOString(),
            checked_out_at: outAt ? outAt.toISOString() : null,
            duration_minutes: duration,
            punctuality_rating: editForm.punctuality_rating || null,
            punctuality_note: editForm.punctuality_note || null,
            source: "manual",
          })
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Attendance updated" });
      setEditRecord(null);
      qc.invalidateQueries({ queryKey: ["wofbi-att-all-records"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-roster-records"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-record-counts"] });
    },
    onError: (e) =>
      toast({
        title: "Save failed",
        description: e?.message || e?.details || e?.hint || "Something stopped this attendance record from saving.",
        variant: "destructive",
      }),
  });

  const deleteRecord = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from("wofbi_attendance_records")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Attendance record deleted" });
      qc.invalidateQueries({ queryKey: ["wofbi-att-all-records"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-roster-records"] });
      qc.invalidateQueries({ queryKey: ["wofbi-att-record-counts"] });
    },
    onError: (e) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const openEdit = (session, registration, record) => {
    const toLocal = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      const off = d.getTimezoneOffset() * 60000;
      return new Date(d - off).toISOString().slice(0, 16);
    };
    setEditRecord({ session, registration, record });
    setEditForm({
      status: record?.status || "present",
      checked_in_at: toLocal(record?.checked_in_at) || `${session.session_date}T09:00`,
      checked_out_at: toLocal(record?.checked_out_at),
      punctuality_rating: record?.punctuality_rating || null,
      punctuality_note: record?.punctuality_note || "",
    });
  };

  // Arrival position per attendance record (1st, 2nd, 3rd ... within each session)
  const positionByRecord = useMemo(() => buildPositionMap(allRecords), [allRecords]);

  // Attendance % per student
  const perStudent = useMemo(() => {
    const totalSessions = sessions.length;
    const list = roster.map((r) => {
      const recs = allRecords.filter((x) => x.registration_id === r.id);
      const present = recs.filter((x) => x.status === "present").length;
      const late = recs.filter((x) => x.status === "late").length;
      const attended = present + late;
      const absent = Math.max(0, totalSessions - attended);
      const totalMinutes = recs.reduce((sum, x) => sum + (x.duration_minutes || 0), 0);
      const missingCheckouts = recs.filter((x) => x.checked_in_at && !x.checked_out_at).length;
      const punctualityScore = totalSessions
        ? Math.round((present * 100 + late * 50) / totalSessions)
        : 0;
      const rated = recs.filter((x) => x.punctuality_rating);
      const manualRating = rated.length
        ? Math.round((rated.reduce((sum, x) => sum + x.punctuality_rating, 0) / rated.length) * 10) / 10
        : null;
      const positions = recs.map((x) => positionByRecord.get(x.id)).filter(Boolean);
      const avgPosition = positions.length
        ? Math.round((positions.reduce((sum, p) => sum + p, 0) / positions.length) * 10) / 10
        : null;
      return {
        registration: r,
        present,
        late,
        absent,
        totalSessions,
        totalMinutes,
        missingCheckouts,
        punctualityScore,
        manualRating,
        avgPosition,
        positionsCount: positions.length,
        percent: totalSessions ? Math.round((attended / totalSessions) * 100) : 0,
      };
    });
    // Dense rank on avgPosition (lower is better); un-ranked students go last
    const ranked = list.filter((s) => s.avgPosition != null).sort((a, b) => a.avgPosition - b.avgPosition);
    let rank = 0;
    let prev = null;
    ranked.forEach((s, idx) => {
      if (prev === null || s.avgPosition !== prev) { rank = idx + 1; prev = s.avgPosition; }
      s.punctualityRank = rank;
    });
    return list;
  }, [roster, allRecords, sessions.length, positionByRecord]);

  const exportCsv = () => {
    const header = ["Student number", "Name", "Present", "Late", "Absent", "Total sessions", "Attendance %", "Punctuality %", "Punctuality grade", "Punctuality rating", "Avg. arrival position", "Punctuality rank", "Total hours", "Missing check-outs"];
    const rows = perStudent.map((s) => [
      s.registration.student_number || "",
      `${s.registration.members?.first_name || ""} ${s.registration.members?.last_name || ""}`.trim(),
      s.present,
      s.late,
      s.absent,
      s.totalSessions,
      s.percent,
      s.punctualityScore,
      punctualityGrade(s.punctualityScore).label,
      s.manualRating != null ? `${s.manualRating}/5` : "",
      s.avgPosition != null ? s.avgPosition : "",
      s.punctualityRank ? ordinal(s.punctualityRank) : "",
      (s.totalMinutes / 60).toFixed(2),
      s.missingCheckouts,
    ]);

    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const course = courses.find((c) => c.id === selectedCourseId);
    a.download = `${(course?.name || "course").replace(/\s+/g, "-")}-attendance.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const courseForExport = courses.find((c) => c.id === selectedCourseId);

  const buildSessionRoster = (session) => {
    const recs = allRecords.filter((r) => r.session_id === session.id);
    const byReg = new Map(recs.map((r) => [r.registration_id, r]));
    const rows = roster.map((reg, i) => {
      const rec = byReg.get(reg.id);
      const status = rec ? (rec.status === "late" ? "Late" : rec.status === "excused" ? "Excused" : "Present") : "Absent";
      return [
        i + 1,
        `${reg.members?.first_name || ""} ${reg.members?.last_name || ""}`.trim(),
        reg.student_number || "—",
        status,
        rec && positionByRecord.get(rec.id) ? ordinal(positionByRecord.get(rec.id)) : "—",
        fmtTime(rec?.checked_in_at),
        fmtTime(rec?.checked_out_at),
        fmtDuration(rec?.duration_minutes),
      ];

    });
    const present = rows.filter((r) => r[3] === "Present").length;
    const late = rows.filter((r) => r[3] === "Late").length;
    const subject = subjects.find((s) => s.id === session.subject_id);
    return {
      title: `Attendance Roster — ${session.title || "Session"}`,
      orgName: currentTenant?.name || "",
      logoUrl: currentTenant?.logo_url || null,
      meta: [
        ["Course", courseForExport?.name || "—"],
        session.edition?.name ? ["Edition", session.edition.name] : (!isAllEditions ? ["Edition", editionName] : null),
        subject ? ["Subject", subject.name] : null,
        ["Date", session.session_date],
        ["Status", session.status === "closed" ? "Closed" : "Open"],
        session.notes ? ["Notes", session.notes] : null,
      ].filter(Boolean),
      summary: [
        ["Students", rows.length],
        ["Present", present],
        ["Late", late],
        ["Absent", rows.length - present - late],
        ["Rate", rows.length ? `${Math.round(((present + late) / rows.length) * 100)}%` : "0%"],
      ],
      headers: ["#", "Name", "Student no.", "Status", "Arrival", "Time in", "Time out", "Duration"],
      rows,
      filename: `roster-${courseForExport?.name || "course"}-${session.title || "session"}-${session.session_date}`,
    };
  };

  const buildCourseRoster = () => {
    const rows = perStudent.map((s, i) => [
      i + 1,
      `${s.registration.members?.first_name || ""} ${s.registration.members?.last_name || ""}`.trim(),
      s.registration.student_number || "—",
      s.present,
      s.late,
      s.absent,
      s.totalSessions,
      `${s.percent}%`,
      `${s.punctualityScore}% (${punctualityGrade(s.punctualityScore).label})`,
      s.avgPosition != null ? s.avgPosition : "—",
      s.punctualityRank ? ordinal(s.punctualityRank) : "—",
      (s.totalMinutes / 60).toFixed(2),
      s.missingCheckouts,
    ]);

    const fullyPresent = perStudent.filter((s) => s.absent === 0).length;
    return {
      title: `Attendance Roster — ${courseForExport?.name || "Course"}${isAllEditions ? " (all sessions)" : ` — ${editionName}`}`,
      orgName: currentTenant?.name || "",
      logoUrl: currentTenant?.logo_url || null,
      meta: [
        ["Course", courseForExport?.name || "—"],
        courseForExport?.course_code ? ["Code", courseForExport.course_code] : null,
        !isAllEditions ? ["Edition", editionName] : null,
        ["Sessions", sessions.length],
      ].filter(Boolean),
      summary: [
        ["Students", rows.length],
        ["Sessions", sessions.length],
        ["Full attendance", fullyPresent],
      ],
      headers: ["#", "Name", "Student no.", "Present", "Late", "Absent", "Sessions", "Attendance", "Punctuality", "Avg. position", "Rank", "Hours", "Missing check-outs"],
      rows,
      filename: `roster-${courseForExport?.name || "course"}${isAllEditions ? "" : `-${editionName}`}-summary`,
    };
  };

  const handleRosterExport = async (format) => {
    const session = rosterExportScope === "summary" ? null : sessions.find((s) => s.id === rosterExportScope);
    const data = session ? buildSessionRoster(session) : buildCourseRoster();
    if (!data.rows.length) {
      toast({ title: "Nothing to export", description: "No registered students on this roster yet.", variant: "destructive" });
      return;
    }
    setRosterExporting(true);
    try {
      if (format === "csv") downloadRosterCsv(data);
      else await printRosterPdf(data);
      setRosterExportOpen(false);
    } catch (e) {
      toast({ title: "Roster export failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setRosterExporting(false);
    }
  };

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view Bible School attendance.</p>;
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-lg">Bible School Attendance</CardTitle>
            <p className="text-xs text-muted-foreground">Run on-premise QR check-in per course.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-full sm:w-[220px] [&>span]:truncate">
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => setQrOpen(true)} className="gap-2 flex-1 sm:flex-none">
              <QrCode className="h-4 w-4" /> Session QR
            </Button>
            <Button onClick={() => { setForm(emptySessionForm()); setNewOpen(true); }} disabled={!selectedCourseId} className="gap-2 flex-1 sm:flex-none">
              <Plus className="h-4 w-4" /> New session
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                No attendance sessions yet for this course
                {!isAllEditions ? ` in ${editionName}` : ""}.
              </p>
              {!isAllEditions && (
                <Button variant="link" size="sm" onClick={() => setEditionId(EXAM_SESSION_ALL)}>
                  Show all editions
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => {
                  const c = recordsBySession[s.id] || { present: 0, late: 0 };
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap">{s.session_date}</TableCell>
                      <TableCell className="font-medium">
                        {s.title}
                        {isAllEditions && s.edition?.name && (
                          <span className="block text-[11px] font-normal text-muted-foreground">{s.edition.name}</span>
                        )}
                      </TableCell>
                      <TableCell>{c.present}</TableCell>
                      <TableCell>{c.late}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {s.status === "open" ? (
                            <Badge className="bg-green-100 text-green-800">Open</Badge>
                          ) : (
                            <Badge variant="secondary">Closed</Badge>
                          )}
                          {(s.scheduled_open_at || s.scheduled_close_at) && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {s.scheduled_open_at ? `Opens ${fmtLocal(s.scheduled_open_at)}` : ""}
                              {s.scheduled_open_at && s.scheduled_close_at ? " · " : ""}
                              {s.scheduled_close_at ? `Closes ${fmtLocal(s.scheduled_close_at)}` : ""}
                            </span>
                          )}
                          {!s.scheduled_open_at && !s.scheduled_close_at && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">No auto open/close schedule</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => setRosterSession(s)}>
                          Roster
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openSessionEdit(s)} aria-label="Edit session">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {s.status === "open" ? (
                          <Button size="sm" variant="ghost" onClick={() => closeSession.mutate(s.id)}>
                            Close
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => reopenSession.mutate(s.id)}>
                            Reopen
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (await confirmDelete({ title: "Delete attendance session", itemName: s.title, highImpact: true, impacts: ["All check-ins recorded in this session will be deleted."] })) deleteSession.mutate(s.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">Attendance report</CardTitle>
            <p className="text-xs text-muted-foreground">
              {selectedCourse?.name || "Course"} · {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => { setRosterExportScope(sessions[0]?.id || "summary"); setRosterExportOpen(true); }}
              disabled={!roster.length}
              className="gap-2 w-full sm:w-auto"
            >
              <Download className="h-4 w-4" /> Download roster
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!perStudent.length} className="gap-2 w-full sm:w-auto">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {perStudent.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No registered students on this course yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Student #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Total hours</TableHead>
                  <TableHead>Missing out</TableHead>
                  <TableHead>Attendance %</TableHead>
                  <TableHead>Punctuality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perStudent.map((s) => {
                  const expanded = !!expandedStudents[s.registration.id];
                  const studentRecs = allRecords.filter((x) => x.registration_id === s.registration.id);
                  const recByS = new Map(studentRecs.map((r) => [r.session_id, r]));
                  const sortedSessions = [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date));
                  return (
                    <React.Fragment key={s.registration.id}>
                      <TableRow className="cursor-pointer" onClick={() => setExpandedStudents((p) => ({ ...p, [s.registration.id]: !expanded }))}>
                        <TableCell>
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                        <TableCell>{s.registration.student_number || "—"}</TableCell>
                        <TableCell className="font-medium">
                          {`${s.registration.members?.first_name || ""} ${s.registration.members?.last_name || ""}`.trim() || "Unknown"}
                        </TableCell>
                        <TableCell>{s.present}</TableCell>
                        <TableCell>{s.late}</TableCell>
                        <TableCell>{s.absent}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDuration(s.totalMinutes)}</TableCell>
                        <TableCell>
                          {s.missingCheckouts > 0 ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800">{s.missingCheckouts}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={s.percent >= 75 ? "bg-green-100 text-green-800" : s.percent >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}>
                            {s.percent}%
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col items-start gap-0.5">
                            <Badge className={punctualityGrade(s.punctualityScore).cls}>
                              {s.punctualityScore}% · {punctualityGrade(s.punctualityScore).label}
                            </Badge>
                            {s.manualRating != null && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {s.manualRating}/5 rated
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={10} className="p-0">
                            <div className="p-3 overflow-x-auto">
                              <Table className="min-w-[560px]">

                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Session</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Time in</TableHead>
                                    <TableHead>Time out</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Punctuality</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sortedSessions.map((sess) => {
                                    const rec = recByS.get(sess.id);
                                    const status = rec?.status || "absent";
                                    return (
                                      <TableRow key={sess.id}>
                                        <TableCell className="whitespace-nowrap text-xs">{sess.session_date}</TableCell>
                                        <TableCell className="text-xs">{sess.title}</TableCell>
                                        <TableCell>
                                          {status === "present" && <Badge className="bg-green-100 text-green-800">Present</Badge>}
                                          {status === "late" && <Badge className="bg-amber-100 text-amber-800">Late</Badge>}
                                          {status === "absent" && <Badge variant="secondary">Absent</Badge>}
                                        </TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{fmtTime(rec?.checked_in_at)}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{fmtTime(rec?.checked_out_at)}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{fmtDuration(rec?.duration_minutes)}</TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">
                                          {rec?.punctuality_rating ? (
                                            <span className="inline-flex items-center gap-1" title={rec.punctuality_note || ""}>
                                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {rec.punctuality_rating}/5
                                            </span>
                                          ) : "—"}
                                        </TableCell>
                                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                                          <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(sess, s.registration, rec)}>
                                            <Pencil className="h-3 w-3" /> Edit
                                          </Button>
                                          {rec?.id && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={async () => {
                                                if (await confirmDelete({ title: "Delete attendance record", description: "This check-in record will be permanently deleted." })) deleteRecord.mutate(rec.id);
                                              }}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New / edit session dialog */}
      <Dialog
        open={newOpen || !!editSession}
        onOpenChange={(v) => {
          if (!v) { setNewOpen(false); setEditSession(null); }
        }}
      >
        <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
          <TenantDialogHeader>{editSession ? "Edit Attendance Session" : "New Attendance Session"}</TenantDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Week 3 - Doctrine" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Late after (optional)</Label>
                <Input type="time" value={form.late_after} onChange={(e) => setForm({ ...form, late_after: e.target.value })} />
              </div>
            </div>
            {pinnedEdition && form.session_date && (
              ((pinnedEdition.starts_on && form.session_date < pinnedEdition.starts_on) ||
                (pinnedEdition.ends_on && form.session_date > pinnedEdition.ends_on)) && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                  This date falls outside <span className="font-medium">{pinnedEdition.name}</span>
                  {pinnedEdition.starts_on && pinnedEdition.ends_on
                    ? ` (${pinnedEdition.starts_on} to ${pinnedEdition.ends_on})`
                    : ""}. The session will still be recorded under this edition.
                </p>
              )
            )}
            {subjects.length > 0 && (
              <div className="space-y-1.5">
                <Label>Subject (optional)</Label>
                <Select value={form.subject_id || "none"} onValueChange={(v) => setForm({ ...form, subject_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="No subject" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No subject</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Auto open / close (optional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Auto-open at</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduled_open_at}
                    onChange={(e) => setForm({ ...form, scheduled_open_at: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Auto-close at</Label>
                  <Input
                    type="datetime-local"
                    value={form.scheduled_close_at}
                    onChange={(e) => setForm({ ...form, scheduled_close_at: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank to open and close the session manually. The QR link becomes valid and invalid at these times.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            {editSession && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Closing a session clears any auto open/close schedule.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setNewOpen(false); setEditSession(null); }}>Cancel</Button>
            {editSession ? (
              <Button
                onClick={() => updateSession.mutate(form)}
                disabled={!form.title || !form.session_date || updateSession.isPending}
              >
                {updateSession.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save changes
              </Button>
            ) : (
              <Button
                onClick={() => createSession.mutate(form)}
                disabled={!form.title || !form.session_date || createSession.isPending}
              >
                {createSession.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create session
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Persistent Session QR */}
      <WoFBIPersistentQRDialog open={qrOpen} onOpenChange={setQrOpen} />

      {/* Roster override dialog */}
      <Dialog open={!!rosterSession} onOpenChange={(v) => !v && setRosterSession(null)}>
        <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
          <TenantDialogHeader>Roster · {rosterSession?.title}</TenantDialogHeader>
          <div className="max-h-[65vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time in</TableHead>
                  <TableHead>Time out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Punctuality</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((r) => {
                  const rec = rosterRecords.find((x) => x.registration_id === r.id);
                  const status = rec?.status || "absent";
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">
                          {`${r.members?.first_name || ""} ${r.members?.last_name || ""}`.trim() || "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.student_number || "—"}</div>
                      </TableCell>
                      <TableCell>
                        {status === "present" && <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle2 className="h-3 w-3" /> Present</Badge>}
                        {status === "late" && <Badge className="bg-amber-100 text-amber-800 gap-1"><Clock className="h-3 w-3" /> Late</Badge>}
                        {status === "absent" && <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Absent</Badge>}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(rec?.checked_in_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtTime(rec?.checked_out_at)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDuration(rec?.duration_minutes)}</TableCell>
                      <TableCell>
                        <StarRating
                          value={rec?.punctuality_rating || 0}
                          disabled={markStatus.isPending}
                          onChange={(n) => requestRosterEdit({ registration: r, action: "set_rating", rating: n }, r, n ? `set punctuality to ${n} star${n > 1 ? "s" : ""}` : "clear the punctuality rating")}
                        />
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant={status === "present" ? "default" : "outline"} onClick={() => requestRosterEdit({ registration: r, status: "present" }, r, "mark as Present")}>Present</Button>
                        <Button size="sm" variant={status === "late" ? "default" : "outline"} onClick={() => requestRosterEdit({ registration: r, status: "late" }, r, "mark as Late")}>Late</Button>
                        <Button size="sm" variant={status === "absent" ? "default" : "outline"} onClick={() => requestRosterEdit({ registration: r, status: "absent" }, r, "mark as Absent")}>Absent</Button>
                        {rec && !rec.checked_out_at && (
                          <Button size="sm" variant="outline" onClick={() => setTimeOutConfirm({ registration: r, action: "set_time_out" })}>Time-out</Button>
                        )}
                        {rec?.checked_out_at && (
                          <Button size="sm" variant="ghost" onClick={() => setTimeOutConfirm({ registration: r, action: "clear_time_out" })}>Clear out</Button>
                        )}
                      </TableCell>


                    </TableRow>
                  );
                })}
                {roster.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">No registered students.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Time-out confirmation */}
      <AlertDialog open={!!timeOutConfirm} onOpenChange={(v) => !v && setTimeOutConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {timeOutConfirm?.action === "clear_time_out" ? "Clear time-out?" : "Record time-out?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const name = `${timeOutConfirm?.registration?.members?.first_name || ""} ${timeOutConfirm?.registration?.members?.last_name || ""}`.trim() || "this student";
                return timeOutConfirm?.action === "clear_time_out"
                  ? `This removes the recorded time-out and duration for ${name}. They will show as still on premises.`
                  : `This checks ${name} out now and ends their time on premises. Only continue if they are leaving.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (timeOutConfirm) {
                  requestRosterEdit(
                    { registration: timeOutConfirm.registration, action: timeOutConfirm.action },
                    timeOutConfirm.registration,
                    timeOutConfirm.action === "clear_time_out" ? "clear the recorded time-out" : "record a time-out"
                  );
                }
                setTimeOutConfirm(null);
              }}
            >
              {timeOutConfirm?.action === "clear_time_out" ? "Clear time-out" : "Check out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password gate for roster edits */}
      <PasswordConfirmDialog
        open={!!pendingRosterEdit}
        onOpenChange={(v) => !v && setPendingRosterEdit(null)}
        title="Confirm attendance change"
        description={pendingRosterEdit?.description || "Confirm this attendance change."}
        confirmLabel="Apply change"
        isPending={markStatus.isPending}
        onConfirm={() => {
          if (pendingRosterEdit) markStatus.mutate(pendingRosterEdit.payload);
          setPendingRosterEdit(null);
        }}
      />


      {/* Edit record dialog */}

      <Dialog open={!!editRecord} onOpenChange={(v) => !v && setEditRecord(null)}>
        <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-auto max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <div className="px-6 pt-6">
            <TenantDialogHeader>Edit attendance</TenantDialogHeader>
          </div>
          {editRecord && (
            <div className="space-y-4 py-2 px-6 overflow-y-auto flex-1">
              <div className="text-sm">
                <div className="font-medium">
                  {`${editRecord.registration.members?.first_name || ""} ${editRecord.registration.members?.last_name || ""}`.trim()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {editRecord.session.session_date} · {editRecord.session.title}
                </div>
              </div>
              {editRecord.session.status === "closed" && (
                <p className="text-xs rounded-md bg-muted px-3 py-2 text-muted-foreground">
                  This session is closed. As an admin you can still record or change attendance here.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="absent">Absent (removes record)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editForm.status !== "absent" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Time in *</Label>
                    <Input type="datetime-local" className="w-full" value={editForm.checked_in_at} onChange={(e) => setEditForm((f) => ({ ...f, checked_in_at: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Time out</Label>
                    <Input type="datetime-local" className="w-full" value={editForm.checked_out_at} onChange={(e) => setEditForm((f) => ({ ...f, checked_out_at: e.target.value }))} />
                  </div>
                </div>
              )}
              {editForm.status !== "absent" && (
                <div className="space-y-1.5">
                  <Label>Punctuality rating</Label>
                  <div className="flex items-center gap-2">
                    <StarRating
                      value={editForm.punctuality_rating || 0}
                      onChange={(n) => setEditForm((f) => ({ ...f, punctuality_rating: n }))}
                    />
                    <span className="text-xs text-muted-foreground">
                      {editForm.punctuality_rating ? `${editForm.punctuality_rating}/5` : "Not rated (auto score used)"}
                    </span>
                  </div>
                  <Input
                    placeholder="Optional comment (e.g. arrived 10 mins late)"
                    value={editForm.punctuality_note || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, punctuality_note: e.target.value }))}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] gap-2">
            <Button variant="ghost" onClick={() => setEditRecord(null)}>Cancel</Button>
            <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
              {saveEdit.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Roster download */}
      <Dialog open={rosterExportOpen} onOpenChange={setRosterExportOpen}>
        <DialogContent className="max-w-md">
          <TenantDialogHeader title="Download attendance roster" subtitle={selectedCourse?.name || "Course"} />
          <div className="space-y-3 px-1 py-2">
            <div className="space-y-1.5">
              <Label>Roster</Label>
              <Select value={rosterExportScope} onValueChange={setRosterExportScope}>
                <SelectTrigger><SelectValue placeholder="Choose a roster" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Course summary (all sessions)</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title || "Session"} — {s.session_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Every registered student is listed, including those marked absent.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleRosterExport("csv")} disabled={rosterExporting} className="gap-2">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button onClick={() => handleRosterExport("pdf")} disabled={rosterExporting} className="gap-2">
              {rosterExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
