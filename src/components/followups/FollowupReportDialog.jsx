import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import PrintReportButton from "@/components/PrintReportButton";

const FU_STATUSES = ["Pending", "In Progress", "Completed", "Overdue"];
const REF_STATUSES = ["pending", "accepted", "declined", "completed"];
const FU_TYPES = ["First Timer", "New Convert", "Visitor", "Absentee", "Pastoral", "General"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

const isOverdue = (f) =>
  f.due_date && f.status !== "Completed" && new Date(f.due_date) < new Date();

export default function FollowupReportDialog({ open, onOpenChange, followups = [], profileMap = {} }) {
  const { tenantId, scopeQuery } = useTenantQuery();

  const [reportType, setReportType] = useState("followups"); // followups | signposts | combined
  const [dateBasis, setDateBasis] = useState("created_at"); // created_at | due_date | completed_date
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [assigneeFilter, setAssigneeFilter] = useState("All"); // All | unassigned | <user_id>
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [groupBy, setGroupBy] = useState("none"); // none | assignee | status | type | target

  // Referrals
  const { data: referrals = [], isLoading: refLoading } = useQuery({
    queryKey: ["followup-referrals-report", tenantId],
    enabled: !!tenantId && open && reportType !== "followups",
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("followup_referrals")
          .select("*, members(first_name, last_name), wsf_centres(name), followups(followup_type, status, due_date, created_at, assigned_to, priority)")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
  });

  // Build assignee options
  const assigneeOptions = useMemo(() => {
    const ids = new Set();
    followups.forEach(f => f.assigned_to && ids.add(f.assigned_to));
    return [...ids].map(id => ({ id, name: profileMap[id] || "Unknown" }));
  }, [followups, profileMap]);

  // Filter follow-ups
  const filteredFollowups = useMemo(() => {
    return followups.filter(f => {
      if (statusFilter !== "All") {
        if (statusFilter === "Overdue") { if (!isOverdue(f)) return false; }
        else if (f.status !== statusFilter) return false;
      }
      if (typeFilter !== "All" && f.followup_type !== typeFilter) return false;
      if (priorityFilter !== "All" && (f.priority || "Medium") !== priorityFilter) return false;
      if (assigneeFilter !== "All") {
        if (assigneeFilter === "unassigned" && f.assigned_to) return false;
        if (assigneeFilter !== "unassigned" && f.assigned_to !== assigneeFilter) return false;
      }
      const dateVal = (f[dateBasis] || "").toString().split("T")[0];
      if (dateFrom && (!dateVal || dateVal < dateFrom)) return false;
      if (dateTo && (!dateVal || dateVal > dateTo)) return false;
      return true;
    });
  }, [followups, statusFilter, typeFilter, priorityFilter, assigneeFilter, dateBasis, dateFrom, dateTo]);

  // Filter referrals
  const filteredReferrals = useMemo(() => {
    return referrals.filter(r => {
      if (statusFilter !== "All" && statusFilter !== "Overdue") {
        const s = statusFilter.toLowerCase();
        if (r.status !== s && !REF_STATUSES.includes(s)) {
          // status filter doesn't match referral statuses — still allow if Combined uses follow-up status
          if (reportType === "signposts") return false;
        } else if (r.status !== s) return false;
      }
      if (assigneeFilter !== "All") {
        if (assigneeFilter === "unassigned" && r.assigned_leader_id) return false;
        if (assigneeFilter !== "unassigned" && r.assigned_leader_id !== assigneeFilter) return false;
      }
      const dateVal = (r.created_at || "").split("T")[0];
      if (dateFrom && dateVal < dateFrom) return false;
      if (dateTo && dateVal > dateTo) return false;
      return true;
    });
  }, [referrals, statusFilter, assigneeFilter, dateFrom, dateTo, reportType]);

  // Summary stats (based on follow-ups, since referrals are linked to them)
  const stats = useMemo(() => {
    const total = filteredFollowups.length;
    const byStatus = { Pending: 0, "In Progress": 0, Completed: 0, Overdue: 0 };
    let completedDays = 0, completedCount = 0;
    filteredFollowups.forEach(f => {
      if (byStatus[f.status] !== undefined) byStatus[f.status]++;
      if (isOverdue(f)) byStatus.Overdue++;
      if (f.status === "Completed" && f.completed_date && f.created_at) {
        const days = (new Date(f.completed_date) - new Date(f.created_at)) / (1000 * 60 * 60 * 24);
        if (!isNaN(days) && days >= 0) { completedDays += days; completedCount++; }
      }
    });
    const completionRate = total ? Math.round((byStatus.Completed / total) * 100) : 0;
    const avgDays = completedCount ? (completedDays / completedCount).toFixed(1) : "—";
    return { total, byStatus, completionRate, avgDays, referrals: filteredReferrals.length };
  }, [filteredFollowups, filteredReferrals]);

  // Group rows
  const grouped = useMemo(() => {
    const items = reportType === "signposts"
      ? filteredReferrals.map(r => ({
          kind: "signpost",
          person_name: r.members ? `${r.members.first_name} ${r.members.last_name}` : "—",
          followup_type: r.followups?.followup_type || "—",
          status: r.status,
          priority: r.followups?.priority || "",
          assigned_name: r.assigned_leader_id ? (profileMap[r.assigned_leader_id] || "—") : "Unassigned",
          assigned_to: r.assigned_leader_id,
          due_date: r.followups?.due_date || "",
          completed_date: "",
          target: r.target_unit_name || r.wsf_centres?.name || r.referral_type,
          notes: r.notes || "",
          created_at: r.created_at,
        }))
      : filteredFollowups.map(f => ({
          kind: "followup",
          person_name: f.person_name,
          followup_type: f.followup_type,
          status: isOverdue(f) ? "Overdue" : f.status,
          priority: f.priority || "",
          assigned_name: f.assigned_to ? (profileMap[f.assigned_to] || "Unknown") : "Unassigned",
          assigned_to: f.assigned_to,
          due_date: f.due_date || "",
          completed_date: f.completed_date || "",
          target: "",
          notes: f.notes || f.description || "",
          created_at: f.created_at,
        }));

    // Combined: append referral rows under follow-ups
    if (reportType === "combined") {
      filteredReferrals.forEach(r => {
        items.push({
          kind: "signpost",
          person_name: r.members ? `${r.members.first_name} ${r.members.last_name}` : "—",
          followup_type: `↳ Sign-Post (${r.referral_type})`,
          status: r.status,
          priority: "",
          assigned_name: r.assigned_leader_id ? (profileMap[r.assigned_leader_id] || "—") : "Unassigned",
          assigned_to: r.assigned_leader_id,
          due_date: "",
          completed_date: "",
          target: r.target_unit_name || r.wsf_centres?.name || "",
          notes: r.notes || "",
          created_at: r.created_at,
        });
      });
    }

    if (groupBy === "none") return [{ key: "All", rows: items }];
    const keyFn = {
      assignee: (it) => it.assigned_name,
      status: (it) => it.status,
      type: (it) => it.followup_type,
      target: (it) => it.target || "—",
    }[groupBy];
    const map = {};
    items.forEach(it => {
      const k = keyFn(it) || "—";
      (map[k] = map[k] || []).push(it);
    });
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, rows]) => ({ key, rows }));
  }, [reportType, filteredFollowups, filteredReferrals, groupBy, profileMap]);

  const flatRows = useMemo(() => grouped.flatMap(g => g.rows), [grouped]);

  const headers = ["Member", "Type", "Status", "Priority", "Assigned To", "Target", "Due", "Completed", "Notes"];
  const toCells = (it) => [
    it.person_name, it.followup_type, it.status, it.priority,
    it.assigned_name, it.target, it.due_date, it.completed_date, it.notes,
  ];

  const downloadCSV = () => {
    const lines = [headers];
    grouped.forEach(g => {
      if (groupBy !== "none") lines.push([`— ${g.key} (${g.rows.length}) —`]);
      g.rows.forEach(it => lines.push(toCells(it).map(c => String(c ?? "").replace(/[\r\n,]+/g, " "))));
    });
    const csv = lines.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `followup_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildPrintRows = () => {
    const rows = [];
    grouped.forEach(g => {
      if (groupBy !== "none") rows.push([`— ${g.key} (${g.rows.length}) —`, "", "", "", "", "", "", "", ""]);
      g.rows.forEach(it => rows.push(toCells(it)));
    });
    return {
      title: `Follow-up & Sign-Post Report${dateFrom || dateTo ? ` (${dateFrom || "…"} → ${dateTo || "…"})` : ""}`,
      headers,
      rows,
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <TenantDialogHeader>Generate Follow-up Report</TenantDialogHeader>

        <div className="space-y-6 py-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="followups">Follow-ups</SelectItem>
                  <SelectItem value="signposts">Sign-Posts (referrals)</SelectItem>
                  <SelectItem value="combined">Combined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Date Basis</Label>
              <Select value={dateBasis} onValueChange={setDateBasis} disabled={reportType === "signposts"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Created</SelectItem>
                  <SelectItem value="due_date">Due</SelectItem>
                  <SelectItem value="completed_date">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="assignee">Assigned Member</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="target">Referral Target</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {(reportType === "signposts" ? REF_STATUSES : FU_STATUSES).map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter} disabled={reportType === "signposts"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {FU_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter} disabled={reportType === "signposts"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Assigned To</Label>
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {assigneeOptions.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Follow-ups</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold text-accent">{stats.byStatus.Pending}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold text-primary">{stats.byStatus["In Progress"]}</p><p className="text-xs text-muted-foreground">In Progress</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold text-chart-3">{stats.byStatus.Completed}</p><p className="text-xs text-muted-foreground">Completed ({stats.completionRate}%)</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold text-destructive">{stats.byStatus.Overdue}</p><p className="text-xs text-muted-foreground">Overdue</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold">{stats.avgDays}</p><p className="text-xs text-muted-foreground">Avg days · {stats.referrals} sign-posts</p></CardContent></Card>
          </div>

          {/* Preview */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="max-h-[40vh] overflow-auto">
              {refLoading && reportType !== "followups" ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : flatRows.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">No records match the filters.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>{headers.map(h => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {grouped.map(g => (
                      <React.Fragment key={g.key}>
                        {groupBy !== "none" && (
                          <tr className="bg-primary/5">
                            <td colSpan={headers.length} className="px-3 py-1.5 font-semibold text-primary">
                              {g.key} <Badge variant="secondary" className="ml-2">{g.rows.length}</Badge>
                            </td>
                          </tr>
                        )}
                        {g.rows.map((it, i) => (
                          <tr key={`${g.key}-${i}`} className="border-t border-border">
                            {toCells(it).map((c, j) => (
                              <td key={j} className="px-3 py-1.5 align-top">{c || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" onClick={downloadCSV} disabled={!flatRows.length}>
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
          <PrintReportButton label="Print Report" buildRows={buildPrintRows} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
