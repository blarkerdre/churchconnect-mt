import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Shield, UserCog, Trash2, Plus, Edit, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

const actionIcons = {
  role_change: UserCog,
  member_delete: Trash2,
  member_create: Plus,
  member_update: Edit,
};

const actionColors = {
  role_change: "bg-primary/10 text-primary",
  member_delete: "bg-destructive/10 text-destructive",
  member_create: "bg-chart-3/10 text-chart-3",
  member_update: "bg-accent/10 text-accent",
};

export default function AuditLog() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email");
      if (error) throw error;
      return data;
    },
    enabled: isSuperAdmin,
  });

  const getActorName = (userId) => {
    const p = profiles.find(pr => pr.user_id === userId);
    return p?.full_name || p?.email || userId?.slice(0, 8);
  };

  if (!isSuperAdmin) {
    return (
      <Card className="border-0 shadow-sm">
        <div className="p-8 text-center text-muted-foreground">
          Only super admins can access the audit log.
        </div>
      </Card>
    );
  }

  const filtered = logs.filter(log => {
    const matchesSearch = search === "" ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(search.toLowerCase()) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-bold text-foreground">Audit Log</h2>
        <p className="text-sm text-muted-foreground">Track all admin actions across the system</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {uniqueActions.map(a => (
              <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <div className="p-8 text-center text-muted-foreground">No audit logs found</div>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const Icon = actionIcons[log.action] || Shield;
            const colorClass = actionColors[log.action] || "bg-muted text-muted-foreground";
            const details = log.details || {};

            return (
              <Card key={log.id} className="border-0 shadow-sm p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground">
                        {getActorName(log.user_id)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        on {log.entity_type.replace(/_/g, " ")}
                      </span>
                    </div>
                    {Object.keys(details).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {details.target_name && <span>Target: <strong>{details.target_name}</strong>. </span>}
                        {details.old_role && details.new_role && (
                          <span>Role: {details.old_role} → {details.new_role}. </span>
                        )}
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
