import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Download, Send, Loader2, ArrowRight, Users, TrendingUp, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import PrintReportButton from "@/components/PrintReportButton";
import MessageFilteredMembersDialog from "./MessageFilteredMembersDialog";
import { format, subMonths, differenceInDays } from "date-fns";

const STATUS_VALUES = ["any", "Active", "First Timer", "New Convert", "Visitor", "Inactive"];
const PRESETS = [
  { value: "first_to_active", label: "First Timer → Active (became member)", from: "First Timer", to: "Active" },
  { value: "convert_to_active", label: "New Convert → Active", from: "New Convert", to: "Active" },
  { value: "visitor_to_active", label: "Visitor → Active", from: "Visitor", to: "Active" },
  { value: "any_to_active", label: "Any → Active (all conversions to member)", from: "any", to: "Active" },
  { value: "active_to_inactive", label: "Active → Inactive (drop-off)", from: "Active", to: "Inactive" },
  { value: "custom", label: "Custom from → to", from: null, to: null },
];

export default function StatusConversionReport() {
  const { tenantId, scopeQuery } = useTenantQuery();
  const [preset, setPreset] = useState("any_to_active");
  const [fromStatus, setFromStatus] = useState("any");
  const [toStatus, setToStatus] = useState("Active");
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 6), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [messageOpen, setMessageOpen] = useState(false);

  // Apply preset to from/to
  React.useEffect(() => {
    const p = PRESETS.find((x) => x.value === preset);
    if (p && p.value !== "custom") {
      setFromStatus(p.from);
      setToStatus(p.to);
    }
  }, [preset]);

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["status-history", tenantId, dateFrom, dateTo],
    queryFn: async () => {
      const fromIso = new Date(dateFrom).toISOString();
      const toIso = new Date(`${dateTo}T23:59:59.999Z`).toISOString();
      const { data, error } = await scopeQuery(
        supabase
          .from("member_status_history")
          .select("id, member_id, previous_status, new_status, changed_at, changed_by")
          .gte("changed_at", fromIso)
          .lte("changed_at", toIso)
          .order("changed_at", { ascending: false })
      );
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const memberIds = useMemo(() => [...new Set(history.map((h) => h.member_id))], [history]);

  const { data: memberMap = {}, isLoading: loadingMembers } = useQuery({
    queryKey: ["status-history-members", tenantId, memberIds.join(",")],
    queryFn: async () => {
      if (memberIds.length === 0) return {};
      const { data, error } = await scopeQuery(
        supabase
          .from("members")
          .select("id, user_id, first_name, last_name, email, phone, church_unit, created_at, membership_status")
          .in("id", memberIds)
      );
      if (error) throw error;
      const map = {};
      (data || []).forEach((m) => { map[m.id] = m; });
      return map;
    },
    enabled: !!tenantId && memberIds.length > 0,
  });

  // Filter history rows by from/to
  const rows = useMemo(() => {
    return history
      .filter((h) => {
        const fromOk = fromStatus === "any" || h.previous_status === fromStatus;
        const toOk = toStatus === "any" || h.new_status === toStatus;
        return fromOk && toOk;
      })
      .map((h) => {
        const m = memberMap[h.member_id];
        const days = m?.created_at
          ? differenceInDays(new Date(h.changed_at), new Date(m.created_at))
          : null;
        return {
          ...h,
          member: m,
          days_since_join: days,
        };
      })
      .filter((r) => r.member);
  }, [history, fromStatus, toStatus, memberMap]);

  // Unique members from filtered rows (for messaging)
  const uniqueMembers = useMemo(() => {
    const map = {};
    rows.forEach((r) => { if (r.member) map[r.member.id] = r.member; });
    return Object.values(map);
  }, [rows]);

  const summary = useMemo(() => {
    const total = rows.length;
    const validDays = rows.map((r) => r.days_since_join).filter((d) => d !== null && d >= 0);
    const avgDays = validDays.length
      ? Math.round(validDays.reduce((a, b) => a + b, 0) / validDays.length)
      : 0;
    return { total, uniqueCount: uniqueMembers.length, avgDays };
  }, [rows, uniqueMembers.length]);

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Church Unit",
      "Previous Status",
      "New Status",
      "Changed On",
      "Days Since Joining",
    ];
    const out = rows.map((r) => [
      esc(r.member.first_name),
      esc(r.member.last_name),
      esc(r.member.email),
      esc(r.member.phone),
      esc(r.member.church_unit),
      esc(r.previous_status),
      esc(r.new_status),
      esc(format(new Date(r.changed_at), "yyyy-MM-dd")),
      r.days_since_join ?? "",
    ]);
    const csv = [headers.join(","), ...out.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `status-conversions-${dateFrom}-to-${dateTo}.csv`;
    a.click();
  };

  const buildPrintRows = () => ({
    title: `Status Conversion Report (${fromStatus} → ${toStatus}, ${dateFrom} – ${dateTo})`,
    headers: ["Name", "Previous", "New", "Changed On", "Days to Convert", "Phone"],
    rows: rows.map((r) => [
      `${r.member.first_name} ${r.member.last_name}`,
      r.previous_status || "—",
      r.new_status || "—",
      format(new Date(r.changed_at), "dd MMM yyyy"),
      r.days_since_join ?? "—",
      r.member.phone || "—",
    ]),
  });

  const audienceLabel = `${fromStatus} → ${toStatus} between ${dateFrom} and ${dateTo}`;
  const isLoading = loadingHistory || loadingMembers;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Status Conversion Report
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Track when First Timers, New Converts, and Visitors become full members — and message them.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preset + custom */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Conversion type</Label>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Select value={fromStatus} onValueChange={setFromStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s === "any" ? "Any" : s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Select value={toStatus} onValueChange={setToStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_VALUES.map((s) => <SelectItem key={s} value={s}>{s === "any" ? "Any" : s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Changed from</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Changed to</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>
        </div>

        {/* Active filter pill */}
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary border-0">
            {fromStatus} <ArrowRight className="h-3 w-3 mx-1 inline" /> {toStatus}
          </Badge>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm bg-muted/40">
            <CardContent className="p-3 text-center">
              <Users className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-xl font-display font-bold mt-1">{summary.uniqueCount}</p>
              <p className="text-[10px] text-muted-foreground">Members converted</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-muted/40">
            <CardContent className="p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-xl font-display font-bold mt-1">{summary.total}</p>
              <p className="text-[10px] text-muted-foreground">Total transitions</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-muted/40">
            <CardContent className="p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-muted-foreground" />
              <p className="text-xl font-display font-bold mt-1">{summary.avgDays}</p>
              <p className="text-[10px] text-muted-foreground">Avg days to convert</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <PrintReportButton buildRows={buildPrintRows} label="Print Report" />
          <Button size="sm" onClick={() => setMessageOpen(true)} disabled={uniqueMembers.length === 0}>
            <Send className="h-4 w-4 mr-2" /> Message {uniqueMembers.length} Member{uniqueMembers.length !== 1 ? "s" : ""}
          </Button>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No status changes match these filters.</p>
        ) : (
          <div className="overflow-auto max-h-[400px] border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Transition</TableHead>
                  <TableHead className="hidden md:table-cell">Changed On</TableHead>
                  <TableHead className="hidden md:table-cell">Days</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 300).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">
                      {r.member.first_name} {r.member.last_name}
                      <p className="text-[10px] text-muted-foreground">{r.member.church_unit || "—"}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-[11px]">
                        <Badge variant="outline" className="text-[10px]">{r.previous_status || "—"}</Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">{r.new_status}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {format(new Date(r.changed_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{r.days_since_join ?? "—"}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">
                      {r.member.email || r.member.phone || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 300 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Showing first 300 of {rows.length}. Export CSV for the full list.
              </p>
            )}
          </div>
        )}

        <MessageFilteredMembersDialog
          open={messageOpen}
          onOpenChange={setMessageOpen}
          members={uniqueMembers}
          source="conversion_report"
          audienceLabel={audienceLabel}
          filterContext={{ from: fromStatus, to: toStatus, dateFrom, dateTo }}
        />
      </CardContent>
    </Card>
  );
}
