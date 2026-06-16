import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";

export default function InventorySettingsSection() {
  const { tenantId, withTenant } = useTenantQuery();
  const { user } = useAuth();
  const [unit, setUnit] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: currentUnit, isLoading } = useQuery({
    queryKey: ["inv-church-office-unit", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "inventory.church_office_unit")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      return (data?.value && typeof data.value === "string") ? data.value : "Church Office";
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["church-units-active", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("church_units")
        .select("name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");
      return (data || []).map((r) => r.name);
    },
  });

  useEffect(() => {
    if (currentUnit) setUnit(currentUnit);
  }, [currentUnit]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("app_settings").upsert(
        withTenant({
          key: "inventory.church_office_unit",
          value: unit,
          updated_by: user?.id,
        }),
        { onConflict: "key,tenant_id" }
      );
      if (error) throw error;
      toast({ title: "Inventory settings saved" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const all = unit && !units.includes(unit) ? [unit, ...units] : units;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" /> Inventory
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Per-tenant inventory configuration.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Church Office unit</Label>
          <Select value={unit} onValueChange={setUnit} disabled={isLoading || !all.length}>
            <SelectTrigger><SelectValue placeholder={isLoading ? "Loading..." : "Select a unit"} /></SelectTrigger>
            <SelectContent>
              {all.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Members of this unit can manage inventory and run inspections (in addition to Admins).
          </p>
        </div>
        <Button onClick={save} disabled={saving || isLoading || !unit} size="sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
