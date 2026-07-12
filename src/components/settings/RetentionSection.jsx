import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

const LABELS = {
  first_timers_unconverted: "First timers not yet converted",
  pastoral_care_closed: "Closed pastoral care cases",
  call_log: "Call log entries",
  sms_log: "SMS delivery log",
  email_send_log: "Email delivery log",
  notifications_read: "Read in-app notifications",
  audit_log: "Audit log entries",
  purged_data_archives: "Deleted-tenant recovery archives",
};

export default function RetentionSection() {
  const { tenantId } = useTenant();
  const qc = useQueryClient();

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["retention-policies", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.from("retention_policies")
        .select("*").eq("tenant_id", tenantId).order("data_category");
      if (error) throw error;
      return data;
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from("retention_policies").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retention-policies"] });
      toast({ title: "Retention updated" });
    },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" /> Data Retention Policies
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Automated daily deletion after these periods. Values are clamped between the shown minimum and maximum.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {policies.map((p) => (
          <div key={p.id} className="border rounded-lg p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="font-medium">{LABELS[p.data_category] || p.data_category}</Label>
              {p.last_run_at && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Last run: {new Date(p.last_run_at).toLocaleDateString()} — deleted {p.last_run_deleted_count ?? 0}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input type="number" min={p.min_days} max={p.max_days}
                defaultValue={p.retention_days}
                onBlur={(e) => {
                  const v = Math.max(p.min_days, Math.min(p.max_days, Number(e.target.value) || p.retention_days));
                  if (v !== p.retention_days) updateMut.mutate({ id: p.id, patch: { retention_days: v } });
                }}
                className="w-24" />
              <span className="text-xs text-muted-foreground">days</span>
              <span className="text-xs text-muted-foreground">({p.min_days}–{p.max_days})</span>
              <Switch checked={p.enabled}
                onCheckedChange={(v) => updateMut.mutate({ id: p.id, patch: { enabled: v } })} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
