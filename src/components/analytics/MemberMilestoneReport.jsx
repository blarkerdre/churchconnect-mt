import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Download, Send, Target, CheckCircle2, XCircle, Loader2, CalendarIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import PrintReportButton from "@/components/PrintReportButton";
import MessageFilteredMembersDialog from "./MessageFilteredMembersDialog";
import { format, startOfDay, endOfDay, subDays, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { key: "bfc_completed", label: "BFC" },
  { key: "bcc_completed", label: "BCC" },
  { key: "lcc_completed", label: "LCC" },
  { key: "ldc_completed", label: "LDC" },
  { key: "water_baptism", label: "Water Baptism" },
  { key: "holy_spirit_baptism", label: "HS Baptism" },
  { key: "winners_satellite", label: "Home Cell" },
];

const STATUS_OPTIONS = ["all", "Active", "Inactive", "First Timer", "New Convert", "Visitor"];

export default function MemberMilestoneReport() {
  const { tenantId, scopeQuery } = useTenantQuery();
  const [selected, setSelected] = useState(["bfc_completed"]);
  const [mode, setMode] = useState("missing"); // missing | completed
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [messageOpen, setMessageOpen] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["milestone-report-members", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("members")
          .select(
            "id, user_id, first_name, last_name, email, phone, gender, membership_status, church_unit, created_at, water_baptism, holy_spirit_baptism, bfc_completed, bcc_completed, lcc_completed, ldc_completed, winners_satellite"
          )
      );
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const units = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      if (m.church_unit)
        m.church_unit
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean)
          .forEach((u) => set.add(u));
    });
    return [...set].sort();
  }, [members]);

  const toggle = (key) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const filtered = useMemo(() => {
    if (selected.length === 0) return [];
    return members.filter((m) => {
      if (statusFilter !== "all" && m.membership_status !== statusFilter) return false;
      if (unitFilter !== "all") {
        const ms = (m.church_unit || "").split(",").map((u) => u.trim());
        if (!ms.includes(unitFilter)) return false;
      }
      return mode === "missing"
        ? selected.some((k) => !m[k])
        : selected.every((k) => m[k]);
    });
  }, [members, selected, statusFilter, unitFilter, mode]);

  const labelsFor = (m) =>
    MILESTONES.filter((ms) => selected.includes(ms.key) && (mode === "missing" ? !m[ms.key] : m[ms.key])).map(
      (ms) => ms.label
    );

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Gender",
      "Status",
      "Church Unit",
      "Joined",
      ...MILESTONES.map((m) => m.label),
      mode === "missing" ? "Missing" : "Completed",
    ];
    const rows = filtered.map((m) => [
      esc(m.first_name),
      esc(m.last_name),
      esc(m.email),
      esc(m.phone),
      esc(m.gender),
      esc(m.membership_status),
      esc(m.church_unit),
      esc(m.created_at ? format(new Date(m.created_at), "yyyy-MM-dd") : ""),
      ...MILESTONES.map((ms) => (m[ms.key] ? "Yes" : "No")),
      esc(labelsFor(m).join("; ")),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `member-milestone-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const buildPrintRows = () => ({
    title: `Member Milestone Report (${mode === "missing" ? "Missing" : "Completed"}: ${selected
      .map((k) => MILESTONES.find((m) => m.key === k)?.label)
      .join(", ")})`,
    headers: ["Name", "Status", "Church Unit", "Phone", mode === "missing" ? "Missing" : "Completed"],
    rows: filtered.map((m) => [
      `${m.first_name} ${m.last_name}`,
      m.membership_status || "",
      m.church_unit || "—",
      m.phone || "—",
      labelsFor(m).join(", "),
    ]),
  });

  const audienceLabel = `${mode === "missing" ? "Missing" : "Completed"} ${selected
    .map((k) => MILESTONES.find((m) => m.key === k)?.label)
    .join(" + ")}${statusFilter !== "all" ? ` · ${statusFilter}` : ""}${unitFilter !== "all" ? ` · ${unitFilter}` : ""}`;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Member Milestones Report
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Filter members by spiritual milestones, then export or message them directly.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Milestone chips */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Milestones</p>
          <div className="flex flex-wrap gap-2">
            {MILESTONES.map((ms) => (
              <Badge
                key={ms.key}
                variant={selected.includes(ms.key) ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggle(ms.key)}
              >
                {ms.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Mode</p>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="missing">Missing milestone(s)</SelectItem>
                <SelectItem value="completed">Completed all selected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Status</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s === "all" ? "All Statuses" : s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Unit</p>
            <Select value={unitFilter} onValueChange={setUnitFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Units</SelectItem>
                {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-sm font-medium">
            {filtered.length} member{filtered.length !== 1 ? "s" : ""} match
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <PrintReportButton buildRows={buildPrintRows} label="Print Report" />
            <Button size="sm" onClick={() => setMessageOpen(true)} disabled={filtered.length === 0}>
              <Send className="h-4 w-4 mr-2" /> Message Members
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : selected.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Select at least one milestone above.</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No members match the current filters.</p>
        ) : (
          <div className="overflow-auto max-h-[400px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden md:table-cell">Unit</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>{mode === "missing" ? "Missing" : "Completed"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 300).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-medium">{m.first_name} {m.last_name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">{m.membership_status}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{m.church_unit || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground">
                      {m.email || m.phone || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {labelsFor(m).map((l) => (
                          <Badge
                            key={l}
                            variant="outline"
                            className={`text-[10px] ${mode === "missing" ? "text-destructive border-destructive/30" : "text-emerald-700 border-emerald-300"}`}
                          >
                            {mode === "missing" ? <XCircle className="h-3 w-3 mr-0.5" /> : <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                            {l}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length > 300 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Showing first 300 of {filtered.length}. Export CSV for the full list.
              </p>
            )}
          </div>
        )}

        <MessageFilteredMembersDialog
          open={messageOpen}
          onOpenChange={setMessageOpen}
          members={filtered}
          source="milestone_report"
          audienceLabel={audienceLabel}
          filterContext={{
            milestones: selected,
            mode,
            status: statusFilter,
            unit: unitFilter,
          }}
        />
      </CardContent>
    </Card>
  );
}
