import React, { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Shield, UserCog, Trash2, Plus, Edit, Clock, Download, ChevronDown, ChevronRight, Mail, MessageSquare, Bell, Award, FileDown, FileUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { format } from "date-fns";

const actionIcons = {
  role_change: UserCog, role_add: UserCog, role_remove: UserCog,
  member_delete: Trash2, member_create: Plus, member_update: Edit,
  member_status_change: Edit, user_delete: Trash2, user_create: Plus, user_disable: Shield,
  email_sent: Mail, sms_sent: MessageSquare, whatsapp_sent: MessageSquare,
  notification_sent: Bell, bulk_message_sent: MessageSquare,
  certificate_issued: Award,
  data_export: FileDown, data_import: FileUp, data_purge: Trash2, data_restore: FileUp,
};

const actionColors = {
  member_delete: "bg-destructive/10 text-destructive",
  user_delete: "bg-destructive/10 text-destructive",
  data_purge: "bg-destructive/10 text-destructive",
  member_create: "bg-chart-3/10 text-chart-3",
  user_create: "bg-chart-3/10 text-chart-3",
  data_export: "bg-accent/10 text-accent",
  data_import: "bg-accent/10 text-accent",
  certificate_issued: "bg-chart-3/10 text-chart-3",
  email_sent: "bg-primary/10 text-primary",
  sms_sent: "bg-primary/10 text-primary",
  whatsapp_sent: "bg-primary/10 text-primary",
  notification_sent: "bg-primary/10 text-primary",
};

const PRESETS = {
  all: null,
  messaging: ["sms_sent", "whatsapp_sent", "email_sent", "bulk_message_sent", "notification_sent"],
  members: ["member_create", "member_update", "member_delete", "member_status_change"],
  data: ["data_export", "data_import", "data_purge", "data_restore"],
  certificates: ["certificate_issued"],
  access: ["role_add", "role_remove", "role_change", "user_create", "user_delete", "user_disable"],
};

export default function AuditLog() {
  const { roles } = useAuth();
  const { tenantId, scopeQuery } = useTenantQuery();
  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [preset, setPreset] = useState("all");
  const [pageSize, setPageSize] = useState(50);
  const [expanded, setExpanded] = useState({});

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log", tenantId, pageSize],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(pageSize)
      );
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles", tenantId],
    queryFn: async () => {
      const { data } = await scopeQuery(supabase.from("profiles").select("user_id, full_name, email"));
      return data || [];
    },
    enabled: isAdmin,
  });

  const getActorName = (userId) => {
    if (!userId) return "System";
    const p = profiles.find((pr) => pr.user_id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };

  const uniqueActions = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs]);

  const filtered = useMemo(() => {
    const presetActions = PRESETS[preset];
    return logs.filter((log) => {
      if (presetActions && !presetActions.includes(log.action)) return false;
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (search) {
        const hay = `${log.action} ${log.entity_type} ${log.entity_id || ""} ${JSON.stringify(log.details || {})}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter, preset]);

  const exportCsv = () => {
    const rows = [
      ["timestamp", "actor", "action", "entity_type", "entity_id", "channel", "recipients", "details"],
      ...filtered.map((l) => [
        new Date(l.created_at).toISOString(),
        getActorName(l.user_id),
        l.action,
        l.entity_type,
        l.entity_id || "",
        l.details?.channel || "",
        l.details?.recipients_count || "",
        JSON.stringify(l.details || {}).replace(/"/g, '""'),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-8 text-center text-muted-foreground">Only admins can access the audit log.</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Audit Log</h2>
          <p className="text-sm text-muted-foreground">Evidence-grade trail of admin and system actions</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-2" />Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.keys(PRESETS).map((k) => (
          <Button key={k} variant={preset === k ? "default" : "outline"} size="sm" onClick={() => setPreset(k)} className="capitalize text-xs">
            {k}
          </Button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm"><div className="p-8 text-center text-muted-foreground">No audit logs found</div></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const Icon = actionIcons[log.action] || Shield;
            const colorClass = actionColors[log.action] || "bg-muted text-muted-foreground";
            const details = log.details || {};
            const isOpen = !!expanded[log.id];
            const before = details.before;
            const after = details.after;
            return (
              <Card key={log.id} className="border-0 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">{getActorName(log.user_id)}</span>
                      <Badge variant="outline" className="text-xs">{log.action.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">on {log.entity_type.replace(/_/g, " ")}</span>
                      {details.channel && <Badge className="text-xs bg-accent/10 text-accent border-0">{details.channel}</Badge>}
                      {details.recipients_count != null && <Badge className="text-xs bg-primary/10 text-primary border-0">{details.recipients_count} recipient(s)</Badge>}
                    </div>
                    {(details.member_name || details.target_name || details.subject || details.title) && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {details.member_name && <span>Member: <strong>{details.member_name}</strong>. </span>}
                        {details.target_name && <span>Target: <strong>{details.target_name}</strong>. </span>}
                        {details.subject && <span>Subject: {details.subject}. </span>}
                        {details.title && <span>Title: {details.title}. </span>}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(log.created_at), "dd MMM yyyy, HH:mm:ss")}</span>
                      {log.entity_id && <span className="font-mono truncate max-w-[14rem]">id: {log.entity_id}</span>}
                      <button onClick={() => setExpanded((e) => ({ ...e, [log.id]: !isOpen }))} className="flex items-center gap-1 hover:text-foreground">
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Details
                      </button>
                    </div>
                    {isOpen && (
                      <div className="mt-3 space-y-2">
                        {(before || after) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Before</div>
                              <pre className="text-[11px] bg-destructive/5 text-destructive/90 p-2 rounded overflow-x-auto">{JSON.stringify(before ?? null, null, 2)}</pre>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">After</div>
                              <pre className="text-[11px] bg-chart-3/5 text-chart-3/90 p-2 rounded overflow-x-auto">{JSON.stringify(after ?? null, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Full details</div>
                          <pre className="text-[11px] bg-muted/50 p-2 rounded overflow-x-auto">{JSON.stringify(details, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          {logs.length === pageSize && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" size="sm" onClick={() => setPageSize((s) => s + 50)}>Load more</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
