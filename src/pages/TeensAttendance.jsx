import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useTeensUnitRole } from "@/hooks/useTeensUnitRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, QrCode, Calendar, LogIn, LogOut, Users, Pencil, Trash2, FileText, Lock, ShieldAlert, BarChart3, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import TeenAttendanceQRDialog from "@/components/teens/TeenAttendanceQRDialog";

const SESSION_TYPES = [
  "Sunday Service",
  "Midweek Service",
  "Special Service",
  "Bible School",
  "Prayer Meeting",
  "Special Event",
  "Other",
];

function fmtDuration(mins) {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function SessionFormDialog({ open, onOpenChange, session, onSaved }) {
  const { user } = useAuth();
  const { tenantId, withTenant } = useTenantQuery();
  const isEdit = !!session?.id;
  const [form, setForm] = useState(() => ({
    session_type: session?.session_type || "Sunday Service",
    session_date: session?.session_date || format(new Date(), "yyyy-MM-dd"),
    start_time: session?.start_time?.slice(0, 5) || "10:00",
    end_time: session?.end_time?.slice(0, 5) || "12:00",
    late_after: session?.late_after?.slice(0, 5) || "10:15",
    notes: session?.notes || "",
  }));

  React.useEffect(() => {
    if (open) {
      setForm({
        session_type: session?.session_type || "Sunday Service",
        session_date: session?.session_date || format(new Date(), "yyyy-MM-dd"),
        start_time: session?.start_time?.slice(0, 5) || "10:00",
        end_time: session?.end_time?.slice(0, 5) || "12:00",
        late_after: session?.late_after?.slice(0, 5) || "10:15",
        notes: session?.notes || "",
      });
    }
  }, [open, session]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.session_type || !form.session_date) throw new Error("Type and date required");
      const title = `${form.session_type} — Teens · ${format(new Date(form.session_date), "d MMM yyyy")}`;
      const payload = {
        title,
        session_type: form.session_type,
        session_date: form.session_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        late_after: form.late_after || null,
        notes: form.notes || null,
      };
      if (isEdit) {
        const { data, error } = await supabase
          .from("teen_attendance_sessions")
          .update(payload)
          .eq("id", session.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("teen_attendance_sessions")
        .insert(withTenant({ ...payload, status: "open", created_by: user?.id || null }))
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (s) => {
      toast.success(isEdit ? "Session updated" : "Session created");
      onSaved?.(s);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Teens Session" : "New Teens Session"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Service Type</Label>
            <Select value={form.session_type} onValueChange={(v) => setForm({ ...form, session_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.session_date} onChange={(e) => setForm({ ...form, session_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
          </div>
          <div><Label>Late after</Label><Input type="time" value={form.late_after} onChange={(e) => setForm({ ...form, late_after: e.target.value })} /></div>
          <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !tenantId}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RosterDialog({ open, onOpenChange, session, canWrite }) {
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();

  const { data: teens = [] } = useQuery({
    queryKey: ["all-teens", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("teens")
        .select("id, first_name, last_name, attendance_consent")
        .eq("tenant_id", tenantId).eq("is_active", true).order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["teen-records", session?.id],
    enabled: !!session?.id && open,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase.from("teen_attendance_records").select("*").eq("session_id", session.id);
      if (error) throw error;
      return data || [];
    },
  });

  const recMap = useMemo(() => {
    const m = new Map();
    (records || []).forEach((r) => m.set(r.teen_id, r));
    return m;
  }, [records]);

  const signAction = useMutation({
    mutationFn: async (teenId) => {
      const { data, error } = await supabase.rpc("teen_checkin", {
        _qr_token: session.qr_token,
        _teen_id: teenId,
        _pin: null,
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error === "no_consent" ? "No parent consent" : (data?.error || "Failed"));
      return data;
    },
    onSuccess: (d) => {
      toast.success(d.action === "checked_out" ? "Signed out" : d.action === "already_checked_out" ? "Already checked out" : "Signed in");
      qc.invalidateQueries({ queryKey: ["teen-records", session.id] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session?.title} — Roster</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {teens.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No teens registered yet.</p>}
          {teens.map((t) => {
            const r = recMap.get(t.id);
            const state = !r ? "out" : (r.checked_out_at ? "left" : "in");
            const noConsent = !t.attendance_consent;
            return (
              <div key={t.id} className="flex items-center justify-between border rounded-lg p-2">
                <div>
                  <p className="text-sm font-medium">{t.first_name} {t.last_name}</p>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {noConsent && (
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                        <ShieldAlert className="h-3 w-3 mr-1" /> No consent
                      </Badge>
                    )}
                    {state === "in" && <Badge className="bg-green-600 text-white">In · {format(new Date(r.checked_in_at), "HH:mm")}{r.status === "late" ? " (late)" : ""}</Badge>}
                    {state === "left" && <Badge variant="secondary">Left · {fmtDuration(r.duration_minutes)}</Badge>}
                    {state === "out" && !noConsent && <Badge variant="outline">Not in</Badge>}
                  </div>
                </div>
                {canWrite && !noConsent && (
                  <div className="flex gap-1">
                    {state === "out" && (
                      <Button size="sm" onClick={() => signAction.mutate(t.id)} disabled={signAction.isPending}>
                        <LogIn className="h-4 w-4 mr-1" /> In
                      </Button>
                    )}
                    {state === "in" && (
                      <Button size="sm" variant="secondary" onClick={() => signAction.mutate(t.id)} disabled={signAction.isPending}>
                        <LogOut className="h-4 w-4 mr-1" /> Out
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportDialog({ open, onOpenChange, session }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["teen-report", session?.id],
    enabled: !!session?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teen_attendance_records")
        .select("*, teens:teen_id (first_name, last_name)")
        .eq("session_id", session.id)
        .order("checked_in_at");
      if (error) throw error;
      return data || [];
    },
  });

  const downloadCsv = () => {
    const header = ["Name", "Checked in", "Late", "Checked out", "Duration (min)", "Source"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const name = `${r.teens?.first_name || ""} ${r.teens?.last_name || ""}`.trim();
      lines.push([
        JSON.stringify(name),
        r.checked_in_at ? format(new Date(r.checked_in_at), "yyyy-MM-dd HH:mm") : "",
        r.status === "late" ? "Yes" : "No",
        r.checked_out_at ? format(new Date(r.checked_out_at), "yyyy-MM-dd HH:mm") : "",
        r.duration_minutes ?? "",
        r.source || "",
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${session.title.replace(/\s+/g, "-")}-report.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{session?.title} — Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{rows.length} record{rows.length === 1 ? "" : "s"}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={downloadCsv} disabled={rows.length === 0}>Export CSV</Button>
              <Button size="sm" variant="outline" onClick={() => window.print()}>Print</Button>
            </div>
          </div>
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">In</th>
                  <th className="p-2">Out</th>
                  <th className="p-2">Duration</th>
                  <th className="p-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No attendance records.</td></tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.teens?.first_name} {r.teens?.last_name}</td>
                    <td className="p-2">
                      {r.checked_in_at ? format(new Date(r.checked_in_at), "HH:mm") : "—"}
                      {r.status === "late" && <Badge className="ml-1 bg-amber-500 text-white text-[10px]">Late</Badge>}
                    </td>
                    <td className="p-2">{r.checked_out_at ? format(new Date(r.checked_out_at), "HH:mm") : "—"}</td>
                    <td className="p-2">{fmtDuration(r.duration_minutes) || "—"}</td>
                    <td className="p-2 capitalize">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CumulativeReportDialog({ open, onOpenChange }) {
  const { tenantId } = useTenantQuery();
  const today = format(new Date(), "yyyy-MM-dd");
  const ninetyAgo = format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
  const [from, setFrom] = useState(ninetyAgo);
  const [to, setTo] = useState(today);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("summary");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["teen-cumulative", tenantId, from, to],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teen_attendance_records")
        .select("id, checked_in_at, checked_out_at, duration_minutes, status, source, teens:teen_id (first_name, last_name), session:session_id (id, title, session_type, session_date)")
        .eq("tenant_id", tenantId)
        .gte("checked_in_at", `${from}T00:00:00`)
        .lte("checked_in_at", `${to}T23:59:59`)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const sessionTypes = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => { if (r.session?.session_type) set.add(r.session.session_type); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.session?.session_type !== typeFilter) return false;
      if (statusFilter === "on_time" && r.status !== "on_time") return false;
      if (statusFilter === "late" && r.status !== "late") return false;
      if (statusFilter === "missing_out" && r.checked_out_at) return false;
      if (q) {
        const name = `${r.teens?.first_name || ""} ${r.teens?.last_name || ""}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [rows, typeFilter, statusFilter, search]);

  const summary = useMemo(() => {
    const map = new Map();
    filtered.forEach((r) => {
      const name = `${r.teens?.first_name || ""} ${r.teens?.last_name || ""}`.trim() || "Unknown";
      const s = map.get(name) || { name, sessions: 0, onTime: 0, late: 0, minutes: 0, missing: 0 };
      s.sessions += 1;
      if (r.status === "late") s.late += 1;
      else if (r.status === "on_time") s.onTime += 1;
      s.minutes += r.duration_minutes || 0;
      if (!r.checked_out_at) s.missing += 1;
      map.set(name, s);
    });
    return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions);
  }, [filtered]);

  const downloadCsv = () => {
    let header, lines;
    if (view === "summary") {
      header = ["Name", "Sessions attended", "On time", "Late", "Total hours", "Missing check-outs"];
      lines = [header.join(",")];
      summary.forEach((s) => {
        lines.push([
          JSON.stringify(s.name),
          s.sessions,
          s.onTime,
          s.late,
          (s.minutes / 60).toFixed(1),
          s.missing,
        ].join(","));
      });
    } else {
      header = ["Date", "Session", "Type", "Teen", "In", "Out", "Duration (min)", "Status", "Source"];
      lines = [header.join(",")];
      filtered.forEach((r) => {
        const name = `${r.teens?.first_name || ""} ${r.teens?.last_name || ""}`.trim();
        lines.push([
          r.session?.session_date || "",
          JSON.stringify(r.session?.title || ""),
          r.session?.session_type || "",
          JSON.stringify(name),
          r.checked_in_at ? format(new Date(r.checked_in_at), "yyyy-MM-dd HH:mm") : "",
          r.checked_out_at ? format(new Date(r.checked_out_at), "yyyy-MM-dd HH:mm") : "",
          r.duration_minutes ?? "",
          r.status || "",
          r.source || "",
        ].join(","));
      });
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `teens-cumulative-${view}-${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" /> Cumulative Teens Attendance Report</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Session type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {sessionTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="on_time">On time</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="missing_out">Missing check-out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Search teen</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-7" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
          <div className="flex gap-1">
            <Button size="sm" variant={view === "summary" ? "default" : "outline"} onClick={() => setView("summary")}>Summary by teen</Button>
            <Button size="sm" variant={view === "detailed" ? "default" : "outline"} onClick={() => setView("detailed")}>Detailed rows</Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadCsv} disabled={(view === "summary" ? summary.length : filtered.length) === 0}>Export CSV</Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>Print</Button>
          </div>
        </div>

        <div className="border rounded-md overflow-x-auto">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : view === "summary" ? (
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Sessions</th>
                  <th className="p-2">On time</th>
                  <th className="p-2">Late</th>
                  <th className="p-2">On-time %</th>
                  <th className="p-2">Total hours</th>
                  <th className="p-2">Missing out</th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No records for these filters.</td></tr>
                )}
                {summary.map((s) => (
                  <tr key={s.name} className="border-t">
                    <td className="p-2 font-medium">{s.name}</td>
                    <td className="p-2">{s.sessions}</td>
                    <td className="p-2">{s.onTime}</td>
                    <td className="p-2">{s.late}</td>
                    <td className="p-2">{s.sessions ? Math.round((s.onTime / s.sessions) * 100) : 0}%</td>
                    <td className="p-2">{(s.minutes / 60).toFixed(1)}</td>
                    <td className="p-2">{s.missing > 0 ? <Badge variant="destructive">{s.missing}</Badge> : s.missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="p-2">Date</th>
                  <th className="p-2">Session</th>
                  <th className="p-2">Teen</th>
                  <th className="p-2">In</th>
                  <th className="p-2">Out</th>
                  <th className="p-2">Duration</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No records for these filters.</td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 whitespace-nowrap">{r.session?.session_date ? format(new Date(r.session.session_date), "d MMM yyyy") : "—"}</td>
                    <td className="p-2">{r.session?.title || "—"}</td>
                    <td className="p-2">{r.teens?.first_name} {r.teens?.last_name}</td>
                    <td className="p-2">{r.checked_in_at ? format(new Date(r.checked_in_at), "HH:mm") : "—"}</td>
                    <td className="p-2">{r.checked_out_at ? format(new Date(r.checked_out_at), "HH:mm") : "—"}</td>
                    <td className="p-2">{fmtDuration(r.duration_minutes) || "—"}</td>
                    <td className="p-2">
                      {r.status === "late" ? <Badge className="bg-amber-500 text-white">Late</Badge> : r.status === "on_time" ? <Badge variant="secondary">On time</Badge> : r.status || "—"}
                    </td>
                    <td className="p-2 capitalize">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{view === "summary" ? summary.length : filtered.length} {view === "summary" ? "teen(s)" : "record(s)"} · {from} → {to}</p>
      </DialogContent>
    </Dialog>
  );
}

export default function TeensAttendance() {
  const { tenantId } = useTenantQuery();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { isLeader, isMember } = useTeensUnitRole();

  // Admin fallback: check via app-level admin
  const { data: isAdminData } = useQuery({
    queryKey: ["is-admin", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_admin", { _user_id: user.id, _tenant_id: tenantId });
      return !!data;
    },
  });
  const isAdmin = !!isAdminData;

  const canManage = isAdmin || isLeader;         // create/edit/delete/report
  const canWrite = canManage || isMember;         // create + close + sign in/out
  const canDelete = isAdmin || isLeader;

  const [formSession, setFormSession] = useState(null); // {} for new, session for edit
  const [qrSession, setQrSession] = useState(null);
  const [rosterSession, setRosterSession] = useState(null);
  const [reportSession, setReportSession] = useState(null);
  const [deleteSession, setDeleteSession] = useState(null);
  const [cumulativeOpen, setCumulativeOpen] = useState(false);

  const { data: sessions = [], refetch } = useQuery({
    queryKey: ["teen-sessions", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("teen_attendance_sessions").select("*")
        .eq("tenant_id", tenantId).order("session_date", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const closeSession = useMutation({
    mutationFn: async (s) => {
      const { error } = await supabase.from("teen_attendance_sessions").update({ status: "closed" }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session closed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const removeSession = useMutation({
    mutationFn: async (s) => {
      const { error } = await supabase.from("teen_attendance_sessions").delete().eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Session deleted"); setDeleteSession(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Teens Attendance</h1>
          <p className="text-sm text-muted-foreground">On-premise check-in / check-out for registered teens.</p>
        </div>
        {canWrite && (
          <Button onClick={() => setFormSession({})}><Plus className="h-4 w-4 mr-1" /> New session</Button>
        )}
      </div>

      {!canWrite && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
          Only Teens unit members and leaders can manage teens attendance sessions.
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {canWrite && sessions.length === 0 && (
          <Card><CardContent className="p-8 text-sm text-muted-foreground text-center">No teens sessions yet.</CardContent></Card>
        )}
        {canWrite && sessions.map((s) => (
          <Card key={s.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> {s.title}</span>
                {s.status === "open" ? <Badge className="bg-green-600 text-white">Open</Badge> : <Badge variant="secondary">Closed</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {format(new Date(s.session_date), "EEE d MMM yyyy")}
                {s.start_time ? ` · ${s.start_time?.slice(0,5)}` : ""}
                {s.end_time ? ` – ${s.end_time?.slice(0,5)}` : ""}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => setQrSession(s)} disabled={s.status !== "open"}>
                  <QrCode className="h-4 w-4 mr-1" /> Show QR
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRosterSession(s)}>
                  <Users className="h-4 w-4 mr-1" /> Roster
                </Button>
                {s.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => closeSession.mutate(s)} disabled={closeSession.isPending}>
                    <Lock className="h-4 w-4 mr-1" /> Close
                  </Button>
                )}
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setFormSession(s)}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReportSession(s)}>
                      <FileText className="h-4 w-4 mr-1" /> Report
                    </Button>
                  </>
                )}
                {canDelete && (
                  <Button size="sm" variant="destructive" onClick={() => setDeleteSession(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {formSession !== null && (
        <SessionFormDialog
          open={formSession !== null}
          onOpenChange={(o) => !o && setFormSession(null)}
          session={formSession?.id ? formSession : null}
          onSaved={() => { refetch(); qc.invalidateQueries({ queryKey: ["teen-sessions"] }); setFormSession(null); }}
        />
      )}
      {qrSession && (
        <TeenAttendanceQRDialog
          open={!!qrSession}
          onOpenChange={(o) => !o && setQrSession(null)}
          session={qrSession}
          onClosed={() => { refetch(); setQrSession(null); }}
        />
      )}
      {rosterSession && (
        <RosterDialog
          open={!!rosterSession}
          onOpenChange={(o) => !o && setRosterSession(null)}
          session={rosterSession}
          canWrite={canWrite}
        />
      )}
      {reportSession && (
        <ReportDialog
          open={!!reportSession}
          onOpenChange={(o) => !o && setReportSession(null)}
          session={reportSession}
        />
      )}

      <AlertDialog open={!!deleteSession} onOpenChange={(o) => !o && setDeleteSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteSession?.title}</strong> and every attendance record attached to it. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); removeSession.mutate(deleteSession); }}
              disabled={removeSession.isPending}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
