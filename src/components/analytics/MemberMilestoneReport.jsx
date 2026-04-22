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
import { Download, Send, Target, CheckCircle2, XCircle, Loader2, CalendarIcon, X, Home, Users } from "lucide-react";
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

const slugify = (s) =>
  String(s || "all")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "all";

export default function MemberMilestoneReport() {
  const { tenantId } = useTenantQuery();
  const [selected, setSelected] = useState(["bfc_completed"]);
  const [mode, setMode] = useState("missing"); // missing | completed
  const [statusFilter, setStatusFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [centreFilter, setCentreFilter] = useState("all"); // "all" | "unassigned" | <centre_id>
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [datePreset, setDatePreset] = useState("all");
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageMode, setMessageMode] = useState("milestone"); // "milestone" | "unit" | "centre"

  const applyPreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    if (preset === "all") { setFromDate(null); setToDate(null); }
    else if (preset === "30d") { setFromDate(subDays(today, 30)); setToDate(today); }
    else if (preset === "90d") { setFromDate(subDays(today, 90)); setToDate(today); }
    else if (preset === "ytd") { setFromDate(startOfYear(today)); setToDate(today); }
  };

  const clearDates = () => { setFromDate(null); setToDate(null); setDatePreset("all"); };

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["milestone-report-members", tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error("No tenant context");
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: centres = [] } = useQuery({
    queryKey: ["milestone-report-centres", tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error("No tenant context");
      const { data, error } = await supabase
        .from("wsf_centres")
        .select("id, name, is_active")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const centreNameById = useMemo(() => {
    const map = {};
    centres.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [centres]);

  const activeCentres = useMemo(() => centres.filter((c) => c.is_active !== false), [centres]);

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
    const fromMs = fromDate ? startOfDay(fromDate).getTime() : null;
    const toMs = toDate ? endOfDay(toDate).getTime() : null;
    return members.filter((m) => {
      if (statusFilter !== "all" && m.membership_status !== statusFilter) return false;
      if (unitFilter !== "all") {
        if (unitFilter === "__unassigned") {
          if ((m.church_unit || "").trim()) return false;
        } else {
          const ms = (m.church_unit || "").split(",").map((u) => u.trim());
          if (!ms.includes(unitFilter)) return false;
        }
      }
      if (centreFilter !== "all") {
        if (centreFilter === "unassigned") {
          if (m.wsf_centre_id) return false;
        } else if (m.wsf_centre_id !== centreFilter) {
          return false;
        }
      }
      if (fromMs || toMs) {
        const created = m.created_at ? new Date(m.created_at).getTime() : null;
        if (created == null) return false;
        if (fromMs && created < fromMs) return false;
        if (toMs && created > toMs) return false;
      }
      return mode === "missing"
        ? selected.some((k) => !m[k])
        : selected.every((k) => m[k]);
    });
  }, [members, selected, statusFilter, unitFilter, centreFilter, mode, fromDate, toDate]);

  const labelsFor = (m) =>
    MILESTONES.filter((ms) => selected.includes(ms.key) && (mode === "missing" ? !m[ms.key] : m[ms.key])).map(
      (ms) => ms.label
    );

  // Shared CSV helpers
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const formatVal = (v) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (v instanceof Date) return format(v, "yyyy-MM-dd");
    if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(v)) {
        const d = new Date(v);
        if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
      }
      return v;
    }
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  // Fixed export columns: pinned member fields only (no raw record dump),
  // followed by the 7 labeled milestone columns and the summary column.
  const EXPORT_COLUMNS = [
    { key: "first_name", label: "First Name" },
    { key: "last_name", label: "Last Name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "gender", label: "Gender" },
    { key: "membership_status", label: "Status" },
    { key: "church_unit", label: "Church Unit" },
    { key: "wsf_centre_id", label: "Home Cell Centre" },
    { key: "created_at", label: "Joined" },
  ];

  const buildMemberCsvBlock = (list) => {
    const summaryHeader = mode === "missing" ? "Missing" : "Completed";
    const headers = [
      ...EXPORT_COLUMNS.map((c) => c.label),
      ...MILESTONES.map((ms) => ms.label),
      summaryHeader,
    ];

    const rows = list.map((m) => [
      ...EXPORT_COLUMNS.map((c) => {
        if (c.key === "wsf_centre_id") {
          return esc(centreNameById[m.wsf_centre_id] || (m.wsf_centre_id ? "" : "Unassigned"));
        }
        return esc(formatVal(m[c.key]));
      }),
      ...MILESTONES.map((ms) => esc(m[ms.key] ? "Completed" : "Missing")),
      esc(labelsFor(m).join("; ")),
    ]);
    return { headers, rows };
  };

  const downloadCsv = (filename, content) => {
    const blob = new Blob([content], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  };

  const rangeSuffix = fromDate || toDate
    ? `-${fromDate ? format(fromDate, "yyyy-MM-dd") : "any"}_to_${toDate ? format(toDate, "yyyy-MM-dd") : "any"}`
    : "";

  const selectedCentreLabel =
    centreFilter === "all" ? null
    : centreFilter === "unassigned" ? "Unassigned"
    : centreNameById[centreFilter] || "Centre";

  const exportCsv = () => {
    const { headers, rows } = buildMemberCsvBlock(filtered);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const centreSuffix = selectedCentreLabel ? `-centre-${slugify(selectedCentreLabel)}` : "";
    downloadCsv(
      `member-milestone-report-${format(new Date(), "yyyy-MM-dd")}${rangeSuffix}${centreSuffix}.csv`,
      csv
    );
  };

  // Download Centre Members — respects current filters but ignores milestone selection
  // so it returns the full roster of the centre (or grouped roster if "All centres").
  const exportCentreMembers = () => {
    const fromMs = fromDate ? startOfDay(fromDate).getTime() : null;
    const toMs = toDate ? endOfDay(toDate).getTime() : null;
    const baseFiltered = members.filter((m) => {
      if (statusFilter !== "all" && m.membership_status !== statusFilter) return false;
      if (unitFilter !== "all") {
        if (unitFilter === "__unassigned") {
          if ((m.church_unit || "").trim()) return false;
        } else {
          const ms = (m.church_unit || "").split(",").map((u) => u.trim());
          if (!ms.includes(unitFilter)) return false;
        }
      }
      if (fromMs || toMs) {
        const created = m.created_at ? new Date(m.created_at).getTime() : null;
        if (created == null) return false;
        if (fromMs && created < fromMs) return false;
        if (toMs && created > toMs) return false;
      }
      return true;
    });

    if (centreFilter !== "all") {
      const list = baseFiltered.filter((m) =>
        centreFilter === "unassigned" ? !m.wsf_centre_id : m.wsf_centre_id === centreFilter
      );
      if (list.length === 0) return;
      const { headers, rows } = buildMemberCsvBlock(list);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadCsv(
        `home-cell-centre-members-${slugify(selectedCentreLabel)}-${format(new Date(), "yyyy-MM-dd")}.csv`,
        csv
      );
      return;
    }

    // Grouped export: one section per active centre + Unassigned at the end
    const groups = [];
    activeCentres.forEach((c) => {
      const list = baseFiltered.filter((m) => m.wsf_centre_id === c.id);
      groups.push({ name: c.name, list });
    });
    const unassigned = baseFiltered.filter((m) => !m.wsf_centre_id);
    groups.push({ name: "Unassigned", list: unassigned });

    const lines = [];
    lines.push(`Home Cell Centre Members — generated ${format(new Date(), "yyyy-MM-dd HH:mm")}`);
    lines.push("");
    let firstSection = true;
    groups.forEach((g) => {
      if (g.list.length === 0) return;
      if (!firstSection) lines.push("");
      firstSection = false;
      lines.push(`Centre: ${g.name} (${g.list.length} member${g.list.length !== 1 ? "s" : ""})`);
      const { headers, rows } = buildMemberCsvBlock(g.list);
      lines.push(headers.join(","));
      rows.forEach((r) => lines.push(r.join(",")));
    });
    downloadCsv(
      `home-cell-centres-all-${format(new Date(), "yyyy-MM-dd")}.csv`,
      lines.join("\n")
    );
  };

  // Shared base filter (Status + Joined date) used by roster actions —
  // intentionally ignores milestone & unit/centre filters so the caller picks the slice.
  const applyBaseFilters = (list) => {
    const fromMs = fromDate ? startOfDay(fromDate).getTime() : null;
    const toMs = toDate ? endOfDay(toDate).getTime() : null;
    return list.filter((m) => {
      if (statusFilter !== "all" && m.membership_status !== statusFilter) return false;
      if (fromMs || toMs) {
        const created = m.created_at ? new Date(m.created_at).getTime() : null;
        if (created == null) return false;
        if (fromMs && created < fromMs) return false;
        if (toMs && created > toMs) return false;
      }
      return true;
    });
  };

  const memberInUnit = (m, unit) => {
    if (unit === "__unassigned") return !m.church_unit || !m.church_unit.trim();
    const ms = (m.church_unit || "").split(",").map((u) => u.trim()).filter(Boolean);
    return ms.includes(unit);
  };

  const unitRoster = useMemo(() => {
    if (unitFilter === "all") return applyBaseFilters(members);
    return applyBaseFilters(members).filter((m) => memberInUnit(m, unitFilter));
  }, [members, unitFilter, statusFilter, fromDate, toDate]);

  const centreRoster = useMemo(() => {
    if (centreFilter === "all") return applyBaseFilters(members);
    return applyBaseFilters(members).filter((m) =>
      centreFilter === "unassigned" ? !m.wsf_centre_id : m.wsf_centre_id === centreFilter
    );
  }, [members, centreFilter, statusFilter, fromDate, toDate]);

  // Download Unit Members — single unit or grouped by unit when "All Units".
  const exportUnitMembers = () => {
    const base = applyBaseFilters(members);
    if (unitFilter !== "all") {
      const list = base.filter((m) => memberInUnit(m, unitFilter));
      if (list.length === 0) return;
      const { headers, rows } = buildMemberCsvBlock(list);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const slug = unitFilter === "__unassigned" ? "unassigned" : slugify(unitFilter);
      downloadCsv(
        `member-roster-unit-${slug}-${format(new Date(), "yyyy-MM-dd")}.csv`,
        csv
      );
      return;
    }

    // Grouped: one section per known unit + Unassigned at end
    const groups = units.map((u) => ({
      name: u,
      list: base.filter((m) => memberInUnit(m, u)),
    }));
    const unassigned = base.filter((m) => !m.church_unit || !m.church_unit.trim());
    groups.push({ name: "Unassigned", list: unassigned });

    const lines = [];
    lines.push(`Unit Members — generated ${format(new Date(), "yyyy-MM-dd HH:mm")}`);
    lines.push("");
    let firstSection = true;
    groups.forEach((g) => {
      if (g.list.length === 0) return;
      if (!firstSection) lines.push("");
      firstSection = false;
      lines.push(`Unit: ${g.name} (${g.list.length} member${g.list.length !== 1 ? "s" : ""})`);
      const { headers, rows } = buildMemberCsvBlock(g.list);
      lines.push(headers.join(","));
      rows.forEach((r) => lines.push(r.join(",")));
    });
    downloadCsv(
      `member-roster-units-all-${format(new Date(), "yyyy-MM-dd")}.csv`,
      lines.join("\n")
    );
  };

  const openMessage = (modeKey) => {
    setMessageMode(modeKey);
    setMessageOpen(true);
  };

  const dateRangeLabel = (fromDate || toDate)
    ? ` · Joined ${fromDate ? format(fromDate, "yyyy-MM-dd") : "any"} → ${toDate ? format(toDate, "yyyy-MM-dd") : "any"}`
    : "";

  const centreLabelSuffix = selectedCentreLabel ? ` · Centre: ${selectedCentreLabel}` : "";

  const buildPrintRows = () => ({
    title: `Member Milestone Report (${mode === "missing" ? "Missing" : "Completed"}: ${selected
      .map((k) => MILESTONES.find((m) => m.key === k)?.label)
      .join(", ")})${dateRangeLabel}${centreLabelSuffix}`,
    headers: ["Name", "Status", "Church Unit", "Home Cell Centre", "Phone", mode === "missing" ? "Missing" : "Completed"],
    rows: filtered.map((m) => [
      `${m.first_name} ${m.last_name}`,
      m.membership_status || "",
      m.church_unit || "—",
      centreNameById[m.wsf_centre_id] || (m.wsf_centre_id ? "—" : "Unassigned"),
      m.phone || "—",
      labelsFor(m).join(", "),
    ]),
  });

  const unitFilterLabel = unitFilter === "__unassigned" ? "Unassigned (no unit)" : unitFilter;

  const milestoneAudienceLabel = `${mode === "missing" ? "Missing" : "Completed"} ${selected
    .map((k) => MILESTONES.find((m) => m.key === k)?.label)
    .join(" + ")}${statusFilter !== "all" ? ` · ${statusFilter}` : ""}${unitFilter !== "all" ? ` · ${unitFilterLabel}` : ""}${centreLabelSuffix}${dateRangeLabel}`;

  const unitAudienceLabel = `Unit roster: ${unitFilter === "all" ? "All units" : unitFilterLabel}${statusFilter !== "all" ? ` · ${statusFilter}` : ""}${dateRangeLabel}`;
  const centreAudienceLabel = `Centre roster: ${selectedCentreLabel || "All centres"}${statusFilter !== "all" ? ` · ${statusFilter}` : ""}${dateRangeLabel}`;

  const dialogMembers =
    messageMode === "unit" ? unitRoster
    : messageMode === "centre" ? centreRoster
    : filtered;
  const dialogAudienceLabel =
    messageMode === "unit" ? unitAudienceLabel
    : messageMode === "centre" ? centreAudienceLabel
    : milestoneAudienceLabel;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Member Milestones Report
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Filter by milestones or Home Cell centre, then export or message members directly.
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <SelectItem value="__unassigned">Unassigned (no unit)</SelectItem>
                {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Home Cell Centre</p>
            <Select value={centreFilter} onValueChange={setCentreFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Centres</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {activeCentres.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Date range filter */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Joined date range</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All time" },
              { key: "30d", label: "Last 30 days" },
              { key: "90d", label: "Last 90 days" },
              { key: "ytd", label: "This year" },
              { key: "custom", label: "Custom" },
            ].map((p) => (
              <Badge
                key={p.key}
                variant={datePreset === p.key ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 justify-start text-left font-normal", !fromDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {fromDate ? format(fromDate, "PPP") : "From date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={(d) => { setFromDate(d || null); setDatePreset("custom"); }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("h-9 justify-start text-left font-normal", !toDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {toDate ? format(toDate, "PPP") : "To date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={(d) => { setToDate(d || null); setDatePreset("custom"); }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {(fromDate || toDate) && (
              <Button variant="ghost" size="sm" onClick={clearDates} className="h-9">
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Roster actions — act on full unit/centre roster, independent of milestone selection */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Roster actions</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportUnitMembers} disabled={!tenantId || unitRoster.length === 0}>
              <Users className="h-4 w-4 mr-2" />
              {unitFilter === "all" ? "Download All Units" : "Download Unit Members"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => openMessage("unit")} disabled={!tenantId || unitRoster.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              {unitFilter === "all" ? "Message All Units" : "Message Unit Members"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCentreMembers} disabled={!tenantId || centreRoster.length === 0}>
              <Home className="h-4 w-4 mr-2" />
              {centreFilter === "all" ? "Download All Centres" : "Download Centre Members"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => openMessage("centre")} disabled={!tenantId || centreRoster.length === 0}>
              <Send className="h-4 w-4 mr-2" />
              {centreFilter === "all" ? "Message All Centres" : "Message Centre Members"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Acts on the {unitFilter === "all" ? "all-units" : `"${unitFilter}"`} unit roster and the {selectedCentreLabel ? `"${selectedCentreLabel}"` : "all-centres"} centre roster (respects Status & Joined date; ignores milestone selection).
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-sm font-medium">
            {filtered.length} member{filtered.length !== 1 ? "s" : ""} match
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!tenantId || filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <PrintReportButton buildRows={buildPrintRows} label="Print Report" />
            <Button size="sm" onClick={() => openMessage("milestone")} disabled={!tenantId || filtered.length === 0}>
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
                  <TableHead className="hidden lg:table-cell">Home Cell Centre</TableHead>
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
                    <TableCell className="hidden lg:table-cell text-xs">
                      {centreNameById[m.wsf_centre_id] || (m.wsf_centre_id ? "—" : <span className="text-muted-foreground">Unassigned</span>)}
                    </TableCell>
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
          members={dialogMembers}
          source={messageMode === "unit" ? "unit_roster" : messageMode === "centre" ? "centre_roster" : "milestone_report"}
          audienceLabel={dialogAudienceLabel}
          filterContext={{
            mode: messageMode,
            milestones: messageMode === "milestone" ? selected : null,
            milestone_mode: messageMode === "milestone" ? mode : null,
            status: statusFilter,
            unit: unitFilter,
            centre: selectedCentreLabel || "all",
            from_date: fromDate ? format(fromDate, "yyyy-MM-dd") : null,
            to_date: toDate ? format(toDate, "yyyy-MM-dd") : null,
          }}
        />
      </CardContent>
    </Card>
  );
}
