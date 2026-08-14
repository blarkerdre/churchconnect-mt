import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Shared "Recorded by" helpers.
 * Options are church members who have an app account (user_id set), tenant-scoped.
 */
export function useRecorderOptions(enabled = true) {
  const { tenantId } = useTenantQuery();
  const { user } = useAuth();

  const { data: rows = [] } = useQuery({
    queryKey: ["recorder-options", tenantId],
    enabled: !!tenantId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("user_id, first_name, last_name")
        .eq("tenant_id", tenantId)
        .not("user_id", "is", null)
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const options = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const m of rows) {
      if (!m.user_id || seen.has(m.user_id)) continue;
      seen.add(m.user_id);
      list.push({
        user_id: m.user_id,
        name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Unnamed member",
      });
    }
    if (user?.id && !seen.has(user.id)) list.unshift({ user_id: user.id, name: "You" });
    return list;
  }, [rows, user?.id]);

  const nameFor = useMemo(() => {
    const map = new Map(options.map((o) => [o.user_id, o.name]));
    return (id) => (id ? map.get(id) || "—" : "—");
  }, [options]);

  return { options, nameFor };
}

/** Admin-only picker. Renders nothing when `visible` is false. */
export default function RecordedBySelect({ value, onChange, visible = true, label = "Recorded by" }) {
  const { user } = useAuth();
  const { options } = useRecorderOptions(visible);
  if (!visible) return null;
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || user?.id || ""} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
