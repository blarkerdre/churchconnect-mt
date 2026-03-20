import React, { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Mail, MessageSquare, Shield, CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Search, UserCog, Trash2, Plus, Edit, CalendarIcon, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

/* ── Shared helpers ── */
function downloadCSV(rows, headers, filename) {
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(h => h.label).join(","), ...rows.map(r => headers.map(h => escape(h.fn(r))).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DateRangePicker({ from, to, onFromChange, onToChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("w-full sm:w-[150px] justify-start text-left font-normal", !from && "text-muted-foreground")}>
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {from ? format(from, "dd MMM yyyy") : "From"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={from} onSelect={onFromChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("w-full sm:w-[150px] justify-start text-left font-normal", !to && "text-muted-foreground")}>
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
            {to ? format(to, "dd MMM yyyy") : "To"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={to} onSelect={onToChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ── Email Logs Tab ── */
const EMAIL_STATUS_OPTIONS = ["All", "sent", "failed", "dlq", "pending", "suppressed"];
const emailStatusConfig = {
  sent: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  failed: { color: "bg-red-100 text-red-700", icon: XCircle },
  dlq: { color: "bg-red-100 text-red-700", icon: XCircle },
  pending: { color: "bg-amber-100 text-amber-700", icon: Clock },
  suppressed: { color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
};
const PAGE_SIZE = 50;

function EmailMiniStat({ title, value, icon: Icon, color }) {
  const colorMap = { blue: "bg-blue-50 text-blue-600", emerald: "bg-emerald-50 text-emerald-600", rose: "bg-rose-50 text-rose-600", amber: "bg-amber-50 text-amber-600" };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}><Icon className="h-4 w-4" /></div>
        <div><p className="text-xs text-muted-foreground">{title}</p><p className="text-xl font-bold text-foreground">{value}</p></div>
      </div>
    </Card>
  );
}

const EMAIL_CSV_HEADERS = [
  { label: "Template", fn: r => r.template_name },
  { label: "Recipient", fn: r => r.recipient_email },
  { label: "Status", fn: r => r.status },
  { label: "Time", fn: r => format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss") },
  { label: "Error", fn: r => r.error_message || "" },
];

function EmailLogsPanel() {
  const [fromDate, setFromDate] = useState(() => subDays(new Date(), 7));
  const [toDate, setToDate] = useState(() => new Date());
  const [templateFilter, setTemplateFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(0);

  const { data: rawLogs = [], isLoading } = useQuery({
    queryKey: ["email-logs", fromDate?.toISOString(), toDate?.toISOString()],
    queryFn: async () => {
      let q = supabase.from("email_send_log").select("*").order("created_at", { ascending: false }).limit(1000);
      if (fromDate) q = q.gte("created_at", fromDate.toISOString());
      if (toDate) q = q.lte("created_at", new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const deduped = useMemo(() => {
    const map = new Map();
    for (const row of rawLogs) { const key = row.message_id || row.id; const existing = map.get(key); if (!existing || new Date(row.created_at) > new Date(existing.created_at)) map.set(key, row); }
    return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [rawLogs]);

  const templates = useMemo(() => ["All", ...Array.from(new Set(deduped.map(r => r.template_name))).sort()], [deduped]);

  const filtered = useMemo(() => deduped.filter(row => {
    if (templateFilter !== "All" && row.template_name !== templateFilter) return false;
    if (statusFilter !== "All" && row.status !== statusFilter) return false;
    return true;
  }), [deduped, templateFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: filtered.length,
    sent: filtered.filter(r => r.status === "sent").length,
    failed: filtered.filter(r => r.status === "failed" || r.status === "dlq").length,
    pending: filtered.filter(r => r.status === "pending").length,
  }), [filtered]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker from={fromDate} to={toDate} onFromChange={d => { setFromDate(d); setPage(0); }} onToChange={d => { setToDate(d); setPage(0); }} />
        <Select value={templateFilter} onValueChange={v => { setTemplateFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Template" /></SelectTrigger>
          <SelectContent>{templates.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>{EMAIL_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s === "All" ? "All Statuses" : s}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => downloadCSV(filtered, EMAIL_CSV_HEADERS, `email-logs-${format(new Date(), "yyyy-MM-dd")}.csv`)} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <EmailMiniStat title="Total" value={stats.total} icon={Mail} color="blue" />
        <EmailMiniStat title="Sent" value={stats.sent} icon={CheckCircle} color="emerald" />
        <EmailMiniStat title="Failed" value={stats.failed} icon={XCircle} color="rose" />
        <EmailMiniStat title="Pending" value={stats.pending} icon={Clock} color="amber" />
      </div>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Template</TableHead><TableHead>Recipient</TableHead><TableHead>Status</TableHead><TableHead className="hidden sm:table-cell">Time</TableHead><TableHead className="hidden md:table-cell">Error</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : paginated.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No emails found</TableCell></TableRow>
            ) : paginated.map(row => {
              const cfg = emailStatusConfig[row.status] || emailStatusConfig.pending;
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

/* ── SMS Logs Tab ── */
const SMS_CSV_HEADERS = [
  { label: "Phone", fn: r => r.recipient_phone },
  { label: "Type", fn: r => r.sms_type },
  { label: "Status", fn: r => r.status },
  { label: "Delivery Status", fn: r => r.delivery_status || "" },
  { label: "Message", fn: r => r.message },
  { label: "Time", fn: r => format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss") },
  { label: "Error", fn: r => r.error_message || "" },
];

function SMSLogsPanel() {
  const [typeFilter, setTypeFilter] = useState("All");
  const [fromDate, setFromDate] = useState(() => subDays(new Date(), 7));
  const [toDate, setToDate] = useState(() => new Date());

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["sms-logs", typeFilter, fromDate?.toISOString(), toDate?.toISOString()],
    queryFn: async () => {
      let query = supabase.from("sms_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (typeFilter !== "All") query = query.eq("sms_type", typeFilter);
      if (fromDate) query = query.gte("created_at", fromDate.toISOString());
      if (toDate) query = query.lte("created_at", new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59).toISOString());
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const sentCount = logs.filter(l => l.status === "sent").length;
  const failedCount = logs.filter(l => l.status === "failed").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["All", "announcement", "event", "followup", "bulk"].map(t => (
              <SelectItem key={t} value={t}>{t === "All" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 text-xs">
          <Badge className="bg-chart-3/10 text-chart-3 border-0">{sentCount} sent</Badge>
          {failedCount > 0 && <Badge className="bg-destructive/10 text-destructive border-0">{failedCount} failed</Badge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => downloadCSV(logs, SMS_CSV_HEADERS, `sms-logs-${format(new Date(), "yyyy-MM-dd")}.csv`)} disabled={logs.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
        </Button>
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No SMS logs found</p>
        ) : logs.map(log => (
          <div key={log.id} className="border rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium truncate">{log.recipient_phone}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{log.sms_type}</Badge>
                <Badge className={`border-0 text-xs ${
                  log.delivery_status === "delivered" ? "bg-chart-3/10 text-chart-3" :
                  ["failed", "undelivered"].includes(log.delivery_status) ? "bg-destructive/10 text-destructive" :
                  log.status === "sent" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                }`}>{log.delivery_status || log.status}</Badge>
              </div>
            </div>
            <p className="text-muted-foreground truncate">{log.message}</p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd MMM yyyy, h:mm a")}</p>
              {log.delivery_updated_at && <p className="text-xs text-muted-foreground">Updated: {format(new Date(log.delivery_updated_at), "h:mm a")}</p>}
            </div>
            {log.error_message && <p className="text-xs text-destructive">{log.error_message}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Audit Logs Tab ── */
const actionIcons = { role_change: UserCog, member_delete: Trash2, member_create: Plus, member_update: Edit };
const actionColors = { role_change: "bg-primary/10 text-primary", member_delete: "bg-destructive/10 text-destructive", member_create: "bg-chart-3/10 text-chart-3", member_update: "bg-accent/10 text-accent" };

const AUDIT_CSV_HEADERS = [
  { label: "Actor", fn: r => r._actorName || r.user_id },
  { label: "Action", fn: r => r.action },
  { label: "Entity Type", fn: r => r.entity_type },
  { label: "Details", fn: r => JSON.stringify(r.details || {}) },
  { label: "Time", fn: r => format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss") },
];

function AuditLogsPanel() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [fromDate, setFromDate] = useState(() => subDays(new Date(), 7));
  const [toDate, setToDate] = useState(() => new Date());

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log", fromDate?.toISOString(), toDate?.toISOString()],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (fromDate) q = q.gte("created_at", fromDate.toISOString());
      if (toDate) q = q.lte("created_at", new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  const getActorName = (userId) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || p?.email || userId?.slice(0, 8);
  };

  const filtered = logs.filter(log => {
    const matchesSearch = search === "" || log.action.toLowerCase().includes(search.toLowerCase()) || log.entity_type.toLowerCase().includes(search.toLowerCase()) || JSON.stringify(log.details || {}).toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  const csvRows = filtered.map(r => ({ ...r, _actorName: getActorName(r.user_id) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker from={fromDate} to={toDate} onFromChange={setFromDate} onToChange={setToDate} />
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {uniqueActions.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => downloadCSV(csvRows, AUDIT_CSV_HEADERS, `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`)} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm"><div className="p-8 text-center text-muted-foreground">No audit logs found</div></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const Icon = actionIcons[log.action] || Shield;
            const colorClass = actionColors[log.action] || "bg-muted text-muted-foreground";
            const details = log.details || {};
            return (
              <Card key={log.id} className="border-0 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}><Icon className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{getActorName(log.user_id)}</span>
                      <Badge variant="outline" className="text-xs">{log.action.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">on {log.entity_type.replace(/_/g, " ")}</span>
                    </div>
                    {Object.keys(details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {details.target_name && <span>Target: <strong>{details.target_name}</strong>. </span>}
                        {details.old_role && details.new_role && <span>Role: {details.old_role} → {details.new_role}. </span>}
                        {details.member_name && <span>Member: {details.member_name}. </span>}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(log.created_at), "dd MMM yyyy, HH:mm")}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function SystemLogs() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">System Logs</h1>
        <p className="text-sm text-muted-foreground">Monitor emails, SMS, and admin activity</p>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="email" className="gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</TabsTrigger>
          <TabsTrigger value="sms" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> SMS</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="audit" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Audit</TabsTrigger>}
        </TabsList>
        <TabsContent value="email"><EmailLogsPanel /></TabsContent>
        <TabsContent value="sms"><SMSLogsPanel /></TabsContent>
        {isSuperAdmin && <TabsContent value="audit"><AuditLogsPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}
