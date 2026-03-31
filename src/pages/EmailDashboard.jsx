import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format, subDays, subHours } from "date-fns";

const TIME_RANGES = [
  { label: "Last 24h", value: "24h", fn: () => subHours(new Date(), 24) },
  { label: "Last 7 days", value: "7d", fn: () => subDays(new Date(), 7) },
  { label: "Last 30 days", value: "30d", fn: () => subDays(new Date(), 30) },
];

const STATUS_OPTIONS = ["All", "sent", "failed", "dlq", "pending", "suppressed", "rate_limited"];

const statusConfig = {
  sent: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  failed: { color: "bg-red-100 text-red-700", icon: XCircle },
  dlq: { color: "bg-red-100 text-red-700", icon: XCircle },
  pending: { color: "bg-amber-100 text-amber-700", icon: Clock },
  suppressed: { color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
};

const PAGE_SIZE = 50;

export default function EmailDashboard() {
  const { tenantId, scopeQuery } = useTenantQuery();
  const [timeRange, setTimeRange] = useState("7d");
  const [templateFilter, setTemplateFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(0);

  const startDate = useMemo(() => {
    const range = TIME_RANGES.find(r => r.value === timeRange);
    return range ? range.fn().toISOString() : subDays(new Date(), 7).toISOString();
  }, [timeRange]);

  // Fetch all logs for the time range (deduplicate client-side by message_id)
  const { data: rawLogs = [], isLoading } = useQuery({
    queryKey: ["email-logs", startDate, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("email_send_log")
        .select("*")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(1000);
      query = scopeQuery(query);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Deduplicate by message_id (keep latest per message_id)
  const deduped = useMemo(() => {
    const map = new Map();
    for (const row of rawLogs) {
      const key = row.message_id || row.id;
      const existing = map.get(key);
      if (!existing || new Date(row.created_at) > new Date(existing.created_at)) {
        map.set(key, row);
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [rawLogs]);

  // Get distinct templates
  const templates = useMemo(() => {
    const set = new Set(deduped.map(r => r.template_name));
    return ["All", ...Array.from(set).sort()];
  }, [deduped]);

  // Apply filters
  const filtered = useMemo(() => {
    return deduped.filter(row => {
      if (templateFilter !== "All" && row.template_name !== templateFilter) return false;
      if (statusFilter !== "All" && row.status !== statusFilter) return false;
      return true;
    });
  }, [deduped, templateFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: filtered.length,
    sent: filtered.filter(r => r.status === "sent").length,
    failed: filtered.filter(r => r.status === "failed" || r.status === "dlq").length,
    pending: filtered.filter(r => r.status === "pending").length,
    suppressed: filtered.filter(r => r.status === "suppressed").length,
  }), [filtered]);

  // Paginate
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Email Logs</h1>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map(r => (
            <Button key={r.value} size="sm" variant={timeRange === r.value ? "default" : "outline"} onClick={() => { setTimeRange(r.value); setPage(0); }}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total" value={stats.total} icon={Mail} color="blue" />
        <StatCard title="Sent" value={stats.sent} icon={CheckCircle} color="emerald" />
        <StatCard title="Failed" value={stats.failed} icon={XCircle} color="rose" />
        <StatCard title="Pending" value={stats.pending} icon={Clock} color="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={templateFilter} onValueChange={v => { setTemplateFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Template" /></SelectTrigger>
          <SelectContent>
            {templates.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s === "All" ? "All Statuses" : s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Time</TableHead>
              <TableHead className="hidden md:table-cell">Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : paginated.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No emails found</TableCell></TableRow>
            ) : paginated.map(row => {
              const cfg = statusConfig[row.status] || statusConfig.pending;
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.template_name}</TableCell>
                  <TableCell className="text-xs max-w-[180px] truncate">{row.recipient_email}</TableCell>
                  <TableCell><Badge className={cfg.color}>{row.status}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{format(new Date(row.created_at), "MMM d, HH:mm")}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-destructive max-w-[200px] truncate">{row.error_message || "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} emails total</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm self-center">{page + 1} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </Card>
  );
}
