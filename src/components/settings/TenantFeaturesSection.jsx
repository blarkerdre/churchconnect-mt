import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, SlidersHorizontal, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FEATURE_MODULES } from "@/lib/feature-modules";

export default function TenantFeaturesSection() {
  const { currentTenant, tenantId, isTenantOwner, isTenantAdmin, refreshTenantContext } = useTenant();
  const { roles } = useAuth();
  const isSuperAdmin = roles?.includes("super_admin");
  const canManage = isSuperAdmin || isTenantOwner || isTenantAdmin;
  const canEdit = isSuperAdmin || isTenantOwner;
  const queryClient = useQueryClient();

  const [disabled, setDisabled] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const initial = currentTenant?.settings?.disabled_features || [];
    setDisabled(initial);
    setDirty(false);
  }, [currentTenant?.id, currentTenant?.settings]);

  const toggle = (key) => {
    const path = `/${key}`;
    setDisabled((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      setDirty(true);
      return next;
    });
  };

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const newSettings = { ...(currentTenant?.settings || {}), disabled_features: disabled };
      const { error } = await supabase
        .from("tenants")
        .update({ settings: newSettings })
        .eq("id", tenantId);
      if (error) throw error;
      toast.success("Module settings saved");
      setDirty(false);
      await refreshTenantContext?.();
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          You don't have permission to manage modules for this tenant.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Modules
        </CardTitle>
        <CardDescription>
          Enable or disable modules for your church. Disabled modules are hidden from the sidebar and navigation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {!canEdit && (
          <p className="text-xs text-muted-foreground pb-2">
            Read-only — only the church owner can change modules.
          </p>
        )}
        {FEATURE_MODULES.map((f) => {
          const path = `/${f.key}`;
          const isOn = !disabled.includes(path);
          return (
            <div key={f.key} className="flex items-center justify-between py-2.5 border-b last:border-b-0">
              <div className="pr-3">
                <p className="text-sm font-medium">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
              <Switch checked={isOn} onCheckedChange={() => toggle(f.key)} disabled={saving || !canEdit} />
            </div>
          );
        })}
        {canEdit && (
          <div className="pt-4 flex justify-end">
            <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
