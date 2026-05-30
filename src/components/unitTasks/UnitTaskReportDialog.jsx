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

const STATUSES = ["Open", "Completed", "Cancelled"];
const ASSIGN_STATUSES = ["Pending", "Acknowledged", "Completed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export default function UnitTaskReportDialog({ open, onOpenChange, unitOptions = [] }) {
  const { tenantId } = useTenantQuery();
  const [unitFilter, setUnitFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("none");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["unit-task-report", tenantId, unitFilter],
    enabled: !!tenantId && open,
    queryFn: async () => {
      let q = supabase
        .from("unit_task_assignments")
        .select("*, members(first_name, last_name), unit_tasks!inner(id, title, unit_name, priority, status, due_date, created_at)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (unitFilter !== "All") q = q.eq("unit_tasks.unit_name", unitFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => rows.filter((r) => {
    const t = r.unit_tasks;
    if (!t) return false;
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (priorityFilter !== "All" && t.priority !== priorityFilter) return false;
    const d = (t.created_at || "").split("T")[0];
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }), [rows, statusFilter, priorityFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const tasks = new Set();
    let ack = 0, done = 0, overdue = 0, doneDays = 0, doneCount = 0;
    const today = new Date().toISOString().split("T")[0];
    filtered.forEach((r) => {
      tasks.add(r.unit_tasks?.id);
      if (r.status === "Acknowledged" || r.status === "Completed") ack++;
      if (r.status === "Completed") {
        done++;
        if (r.completed_at && r.created_at) {
          const days = (new Date(r.completed_at) - new Date(r.created_at)) / (1000 * 60 * 60 * 24);
          if (days >= 0) { doneDays += days; doneCount++; }
        }
      }
      if (r.unit_tasks?.due_date && r.unit_tasks.due_date < today && r.status !== "Completed") overdue++;
    });
    const total = filtered.length;
    return {
      taskCount: tasks.size,
      total,
      ackPct: total ? Math.round((ack / total) * 100) : 0,
      donePct: total ? Math.round((done / total) * 100) : 0,
      overdue,
      avgDays: doneCount ? (doneDays / doneCount).toFixed(1) : "—",
    };
  }, [filtered]);

  const items = useMemo(() => filtered.map((r) => ({
    member: r.members ? `${r.members.first_name} ${r.members.last_name}` : "—",
    title: r.unit_tasks?.title || "—",
    unit: r.unit_tasks?.unit_name || "—",
    priority: r.unit_tasks?.priority || "",
    taskStatus: r.unit_tasks?.status || "",
    assignStatus: r.status,
    due: r.unit_tasks?.due_date || "",
    acknowledged: r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleDateString() : "",
    completed: r.completed_at ? new Date(r.completed_at).toLocaleDateString() : "",
    created: r.created_at ? r.created_at.split("T")[0] : "",
  })), [filtered]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "All", rows: items }];
    const keyFn = {
      assignee: (it) => it.member,
      unit: (it) => it.unit,
      status: (it) => it.assignStatus,
      priority: (it) => it.priority,
    }[groupBy];
    const map = {};
    items.forEach((it) => {
      const k = keyFn(it) || "—";
      (map[k] = map[k] || []).push(it);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([key, rows]) => ({ key, rows }));
  }, [items, groupBy]);

  const headers = ["Task", "Unit", "Member", "Priority", "Task Status", "Assignment", "Due", "Acknowledged", "Completed"];
  const toCells = (it) => [it.title, it.unit, it.member, it.priority, it.taskStatus, it.assignStatus, it.due, it.acknowledged, it.completed];

  const downloadCSV = () => {
    const lines = [headers];
    grouped.forEach((g) => {
      if (groupBy !== "none") lines.push([`— ${g.key} (${g.rows.length}) —`]);
      g.rows.forEach((it) => lines.push(toCells(it).map((c) => String(c ?? "").replace(/[\r\n,]+/g, " "))));
    });
    const csv = lines.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `unit_tasks_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const buildPrintRows = () => {
    const out = [];
    grouped.forEach((g) => {
      if (groupBy !== "none") out.push([`— ${g.key} (${g.rows.length}) —`, "", "", "", "", "", "", "", ""]);
      g.rows.forEach((it) => out.push(toCells(it)));
    });
    return { title: "Unit Tasks Report", headers, rows: out };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <TenantDialogHeader>Unit Tasks Report</TenantDialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All units</SelectItem>
                  {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Task Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="assignee">Assignee</SelectItem>
                  <SelectItem value="unit">Unit</SelectItem>
                  <SelectItem value="status">Assignment Status</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold">{stats.taskCount}</p><p className="text-xs text-muted-foreground">Tasks</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Assignments</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold text-primary">{stats.ackPct}%</p><p className="text-xs text-muted-foreground">Acknowledged</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold text-chart-3">{stats.donePct}%</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold text-destructive">{stats.overdue}</p><p className="text-xs text-muted-foreground">Overdue</p></CardContent></Card>
            <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center"><p className="text-xl font-bold">{stats.avgDays}</p><p className="text-xs text-muted-foreground">Avg days</p></CardContent></Card>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <div className="max-h-[40vh] overflow-auto">
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : items.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">No records match the filters.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>{headers.map((h) => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {grouped.map((g) => (
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
                            {toCells(it).map((c, j) => <td key={j} className="px-3 py-1.5 align-top">{c || "—"}</td>)}
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
          <Button variant="outline" onClick={downloadCSV} disabled={!items.length}>
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
          <PrintReportButton label="Print Report" buildRows={buildPrintRows} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
