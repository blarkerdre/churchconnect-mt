import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import {
  Settings as SettingsIcon, Plus, Pencil, Trash2, Loader2,
  Users, Church, CalendarDays, TrendingUp, Heart, Globe, Bell, Award, Link2, ShieldAlert, BookOpen, Upload, X, ImageIcon, Mail, Phone, CreditCard, Send
} from "lucide-react";
import FollowupTemplatesSection from "@/components/settings/FollowupTemplatesSection";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import WSFCentresSection from "@/components/settings/WSFCentresSection";
import WSFZonesSection from "@/components/settings/WSFZonesSection";
import CertificateTemplateSettings from "@/components/certificates/CertificateTemplateSettings";
import ExternalLinksSection from "@/components/settings/ExternalLinksSection";
import DangerZoneSection from "@/components/settings/DangerZoneSection";
import BookOfTheMonthSettings from "@/components/settings/BookOfTheMonthSettings";

/* ─── Notification Preferences section ─── */
function NotificationPreferencesSection() {
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { data: smsEnabled, isLoading } = useQuery({
    queryKey: ["app-settings", "sms_notifications_enabled", tenantId],
    queryFn: async () => {
      let q = supabase
        .from("app_settings")
        .select("value")
        .eq("key", "sms_notifications_enabled");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data?.value === true || data?.value === null || data === null;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert(withTenant({ key: "sms_notifications_enabled", value: enabled }), { onConflict: "key,tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings", "sms_notifications_enabled"] });
      toast({ title: "Notification preference updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent" /> Notification Preferences
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Control how automated notifications are sent for follow-ups and pastoral care assignments</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email — always on */}
        <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg">
          <div className="min-w-0 mr-2">
            <p className="text-sm font-medium text-foreground">Email Notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">Assignment notifications sent via email</p>
          </div>
          <Badge className="bg-chart-3/10 text-chart-3 border-0">Always On</Badge>
        </div>

        {/* SMS toggle */}
        <div className="flex items-center justify-between p-3 sm:p-4 bg-muted/50 rounded-lg">
          <div className="min-w-0 mr-2">
            <p className="text-sm font-medium text-foreground">SMS Notifications</p>
            <p className="text-xs text-muted-foreground mt-0.5">Send SMS alongside email for follow-up &amp; pastoral care assignments (Twilio costs apply)</p>
          </div>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={smsEnabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
          )}
        </div>

      </CardContent>
    </Card>
  );
}

/* ─── Billing section for tenant owners/admins ─── */
function BillingSection() {
  const { tenantId } = useTenantQuery();
  const { isTenantOwner, isTenantAdmin: isTAdmin } = useTenant();
  const [payLoading, setPayLoading] = useState(false);

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["tenant-subscription", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["tenant-payments", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("payment_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: tenantData } = useQuery({
    queryKey: ["tenant-status", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("subscription_status")
        .eq("id", tenantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const handlePayNow = async () => {
    setPayLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-tenant-checkout", {
        body: { tenant_id: tenantId },
      });
      if (error) throw new Error(error.message || "Payment failed");
      if (!data?.url) throw new Error("Missing checkout URL");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({ title: "Payment Error", description: err.message, variant: "destructive" });
    } finally {
      setPayLoading(false);
    }
  };

  const statusColor = tenantData?.subscription_status === "active" ? "text-emerald-600 bg-emerald-50" : tenantData?.subscription_status === "past_due" ? "text-amber-600 bg-amber-50" : "text-destructive bg-destructive/10";

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-accent" /> Billing & Subscription
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">View your subscription status and make payments</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {subLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
        ) : !subscription ? (
          <p className="text-sm text-muted-foreground">No active subscription configured for this church. Contact your administrator.</p>
        ) : (
          <>
            <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${statusColor}`}>{tenantData?.subscription_status || "active"}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold">{subscription.currency} {Number(subscription.amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Billing Cycle</span><span className="capitalize">{subscription.billing_cycle}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Next Due Date</span><span className={tenantData?.subscription_status !== "active" ? "text-destructive font-medium" : ""}>{subscription.next_due_date}</span></div>
            </div>

            {(isTenantOwner || isTAdmin) && (
              <Button onClick={handlePayNow} disabled={payLoading} className="w-full">
                {payLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirecting...</> : <><CreditCard className="h-4 w-4 mr-2" /> Pay Now via Stripe</>}
              </Button>
            )}

            {payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent Payments</h4>
                <div className="space-y-1.5">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-xs">
                      <span>{p.payment_date}</span>
                      <span className="font-medium">{p.currency} {Number(p.amount).toFixed(2)}</span>
                      <span className="text-muted-foreground">{p.payment_method || "Stripe"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Reusable list section backed by app_settings ─── */
function SettingsListSection({ settingsKey, title, icon: Icon, description }) {
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [itemName, setItemName] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["app-settings", settingsKey, tenantId],
    queryFn: async () => {
      let q = supabase
        .from("app_settings")
        .select("value")
        .eq("key", settingsKey);
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return Array.isArray(data?.value) ? data.value : [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newItems) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert(withTenant({ key: settingsKey, value: newItems }), { onConflict: "key,tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings", settingsKey] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditingIdx(null); setItemName(""); setDialogOpen(true); };
  const openEdit = (idx) => { setEditingIdx(idx); setItemName(items[idx]); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingIdx(null); setItemName(""); };

  const handleSave = () => {
    const name = itemName.trim();
    if (!name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    let updated;
    if (editingIdx !== null) {
      updated = items.map((item, i) => i === editingIdx ? name : item);
    } else {
      if (items.includes(name)) { toast({ title: "Already exists", variant: "destructive" }); return; }
      updated = [...items, name];
    }
    saveMutation.mutate(updated);
    toast({ title: editingIdx !== null ? "Updated" : "Added" });
    closeDialog();
  };

  const handleDelete = (idx) => {
    if (window.confirm(`Delete "${items[idx]}"?`)) {
      saveMutation.mutate(items.filter((_, i) => i !== idx));
      toast({ title: "Deleted" });
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Icon className="h-4 w-4 text-accent" /> {title}
            </CardTitle>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No items configured</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium text-foreground truncate min-w-0 mr-2">{item}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(idx)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingIdx !== null ? "Edit" : "Add"} {title.replace(/s$/, "")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Name</Label>
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Enter name" />
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingIdx !== null ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ─── Church Units section (uses dedicated table) ─── */
function ChurchUnitsSection() {
  const qc = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitName, setUnitName] = useState("");
  const [unitActive, setUnitActive] = useState(true);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["church-units", false, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("church_units").select("*").order("name"));
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, is_active }) => {
      if (id) {
        const { error } = await supabase.from("church_units").update({ name, is_active }).eq("id", id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("church_units").insert(withTenant({ name, is_active }));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["church-units"] });
      toast({ title: editingUnit ? "Unit updated" : "Unit created" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("church_units").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["church-units"] });
      toast({ title: "Unit deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditingUnit(null); setUnitName(""); setUnitActive(true); setDialogOpen(true); };
  const openEdit = (unit) => { setEditingUnit(unit); setUnitName(unit.name); setUnitActive(unit.is_active); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditingUnit(null); setUnitName(""); setUnitActive(true); };

  const handleSave = () => {
    if (!unitName.trim()) { toast({ title: "Unit name is required", variant: "destructive" }); return; }
    saveMutation.mutate({ id: editingUnit?.id, name: unitName.trim(), is_active: unitActive });
  };

  const handleDelete = (unit) => {
    if (window.confirm(`Delete "${unit.name}"?`)) {
      deleteMutation.mutate(unit.id);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> Church Units
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Departments and ministry groups</p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add Unit
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : units.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No church units configured</p>
        ) : (
          <div className="space-y-2">
            {units.map((unit) => (
              <div key={unit.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">{unit.name}</span>
                  <Badge variant={unit.is_active ? "default" : "secondary"} className="text-xs">
                    {unit.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(unit)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(unit)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Edit Unit" : "Add Church Unit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Unit Name</Label>
              <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. Choir" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={unitActive} onCheckedChange={setUnitActive} />
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingUnit ? "Update" : "Create"} Unit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ─── Church Branding section ─── */
function ChurchBrandingSection() {
  const qc = useQueryClient();
  const { currentTenant, tenantId, isTenantAdmin } = useTenant();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  const logoUrl = currentTenant?.logo_url || null;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/tenant-logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(path);

      const publicUrl = urlData.publicUrl + "?t=" + Date.now();

      const { error: updateError } = await supabase
        .from("tenants")
        .update({ logo_url: publicUrl })
        .eq("id", tenantId);
      if (updateError) throw updateError;

      qc.invalidateQueries({ queryKey: ["tenant-branding"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast({ title: "Logo updated successfully" });
      // Force re-render by reloading tenant context
      window.location.reload();
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!tenantId || !window.confirm("Remove the church logo?")) return;
    setUploading(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ logo_url: null })
        .eq("id", tenantId);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["tenant-branding"] });
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast({ title: "Logo removed" });
      window.location.reload();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!isTenantAdmin) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-accent" /> Church Branding
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Upload your church logo. It will appear on the login page and throughout the app.</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="h-24 w-24 rounded-xl bg-muted/50 border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Church logo" className="h-full w-full object-contain" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2 w-full sm:w-auto">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-1.5"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {logoUrl ? "Change Logo" : "Upload Logo"}
            </Button>
            {logoUrl && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRemove}
                disabled={uploading}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" /> Remove Logo
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">PNG, JPG or SVG. Max 2MB.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Favicon & OG Image section ─── */
function FaviconOgImageSection() {
  const qc = useQueryClient();
  const { currentTenant, tenantId, isTenantAdmin } = useTenant();
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingOg, setUploadingOg] = useState(false);
  const [uploadingPwa, setUploadingPwa] = useState(false);
  const faviconInputRef = React.useRef(null);
  const ogInputRef = React.useRef(null);
  const pwaInputRef = React.useRef(null);

  const faviconUrl = currentTenant?.settings?.favicon_url || null;
  const ogImageUrl = currentTenant?.settings?.og_image_url || null;
  const pwaIconUrl = currentTenant?.settings?.pwa_icon_url || null;

  const updateSettings = async (key, value) => {
    const mergedSettings = {
      ...(currentTenant?.settings || {}),
      [key]: value,
    };
    const { error } = await supabase
      .from("tenants")
      .update({ settings: mergedSettings })
      .eq("id", tenantId);
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["tenants"] });
  };

  const handleUpload = async (file, type) => {
    if (!file || !tenantId) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please select an image file", variant: "destructive" });
      return;
    }
    const maxSize = type === "favicon" ? 1 * 1024 * 1024 : type === "pwa-icon" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: `Image must be under ${type === "favicon" ? "1MB" : type === "pwa-icon" ? "2MB" : "5MB"}`, variant: "destructive" });
      return;
    }

    const setUploading = type === "favicon" ? setUploadingFavicon : type === "pwa-icon" ? setUploadingPwa : setUploadingOg;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenantId}/tenant-${type}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl + "?t=" + Date.now();

      const settingsKey = type === "favicon" ? "favicon_url" : type === "pwa-icon" ? "pwa_icon_url" : "og_image_url";
      await updateSettings(settingsKey, publicUrl);
      const label = type === "favicon" ? "Favicon" : type === "pwa-icon" ? "App icon" : "Social image";
      toast({ title: `${label} updated` });
      window.location.reload();
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (type) => {
    const label = type === "favicon" ? "favicon" : type === "pwa-icon" ? "app icon" : "social image";
    if (!tenantId || !window.confirm(`Remove the ${label}?`)) return;
    const setUploading = type === "favicon" ? setUploadingFavicon : type === "pwa-icon" ? setUploadingPwa : setUploadingOg;
    setUploading(true);
    try {
      const settingsKey = type === "favicon" ? "favicon_url" : type === "pwa-icon" ? "pwa_icon_url" : "og_image_url";
      await updateSettings(settingsKey, null);
      toast({ title: `${label.charAt(0).toUpperCase() + label.slice(1)} removed` });
      window.location.reload();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!isTenantAdmin) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Globe className="h-4 w-4 text-accent" /> Favicon & Social Image
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Custom favicon for the browser tab and social/OG image for link previews when your church URL is shared.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Favicon */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Favicon (Browser Tab Icon)</Label>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-muted/50 border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
              {faviconUrl ? (
                <img src={faviconUrl} alt="Favicon" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <input ref={faviconInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0], "favicon")} />
              <Button size="sm" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon} className="gap-1.5">
                {uploadingFavicon ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {faviconUrl ? "Change Favicon" : "Upload Favicon"}
              </Button>
              {faviconUrl && (
                <Button size="sm" variant="outline" onClick={() => handleRemove("favicon")} disabled={uploadingFavicon} className="gap-1.5 text-destructive hover:text-destructive">
                  <X className="h-4 w-4" /> Remove
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">PNG, ICO or SVG. Max 1MB. Recommended: 32×32 or 64×64 px.</p>
            </div>
          </div>
        </div>

        {/* OG Image */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Social / Link Preview Image (OG Image)</Label>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-20 w-36 rounded-lg bg-muted/50 border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
              {ogImageUrl ? (
                <img src={ogImageUrl} alt="OG Image" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <input ref={ogInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0], "og-image")} />
              <Button size="sm" onClick={() => ogInputRef.current?.click()} disabled={uploadingOg} className="gap-1.5">
                {uploadingOg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {ogImageUrl ? "Change Image" : "Upload Image"}
              </Button>
              {ogImageUrl && (
                <Button size="sm" variant="outline" onClick={() => handleRemove("og-image")} disabled={uploadingOg} className="gap-1.5 text-destructive hover:text-destructive">
                  <X className="h-4 w-4" /> Remove
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">PNG or JPG. Max 5MB. Recommended: 1200×630 px.</p>
            </div>
          </div>
        </div>

        {/* PWA App Icon */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">App Icon (PWA)</Label>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-muted/50 border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0">
              {pwaIconUrl ? (
                <img src={pwaIconUrl} alt="PWA Icon" className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <input ref={pwaInputRef} type="file" accept="image/png" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0], "pwa-icon")} />
              <Button size="sm" onClick={() => pwaInputRef.current?.click()} disabled={uploadingPwa} className="gap-1.5">
                {uploadingPwa ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {pwaIconUrl ? "Change App Icon" : "Upload App Icon"}
              </Button>
              {pwaIconUrl && (
                <Button size="sm" variant="outline" onClick={() => handleRemove("pwa-icon")} disabled={uploadingPwa} className="gap-1.5 text-destructive hover:text-destructive">
                  <X className="h-4 w-4" /> Remove
                </Button>
              )}
              <p className="text-[11px] text-muted-foreground">Icon shown when members install the app to their home screen. PNG only, max 2MB. Recommended: 512×512 px.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Communications Settings (email sender name + Twilio numbers) ─── */
function CommunicationsSection() {
  const qc = useQueryClient();
  const { currentTenant, tenantId } = useTenant();
  const [saving, setSaving] = useState(false);
  const [emailSenderName, setEmailSenderName] = useState("");
  const [smsFrom, setSmsFrom] = useState("");
  const [whatsappFrom, setWhatsappFrom] = useState("");

  const settings = currentTenant?.settings || {};

  // Initialize from tenant settings
  React.useEffect(() => {
    if (currentTenant?.settings) {
      const s = currentTenant.settings;
      setEmailSenderName(s.email_sender_name || "");
      setSmsFrom(s.twilio_sms_from || "");
      setWhatsappFrom(s.twilio_whatsapp_from || "");
    }
  }, [currentTenant?.settings]);

  const e164Regex = /^\+[1-9]\d{6,14}$/;

  const handleSave = async () => {
    if (smsFrom && !e164Regex.test(smsFrom.trim())) {
      toast({ title: "Invalid SMS number", description: "Must be E.164 format (e.g. +447123456789)", variant: "destructive" });
      return;
    }
    if (whatsappFrom && !e164Regex.test(whatsappFrom.trim())) {
      toast({ title: "Invalid WhatsApp number", description: "Must be E.164 format (e.g. +447123456789)", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const mergedSettings = {
        ...(currentTenant?.settings || {}),
        email_sender_name: emailSenderName.trim() || null,
        twilio_sms_from: smsFrom.trim() || null,
        twilio_whatsapp_from: whatsappFrom.trim() || null,
      };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: mergedSettings })
        .eq("id", tenantId);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast({ title: "Communications settings saved" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!tenantId) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Mail className="h-4 w-4 text-accent" /> Communications Settings
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Configure the sender name for emails and phone numbers for SMS/WhatsApp. Leave blank to use system defaults.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Email Sender Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Email Sender Name</Label>
          <Input
            value={emailSenderName}
            onChange={(e) => setEmailSenderName(e.target.value)}
            placeholder={currentTenant?.name || "Your Church Name"}
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            Appears as the "From" name in outgoing emails (e.g. "LFC Cardiff &lt;noreply@...&gt;")
          </p>
        </div>

        {/* SMS From Number */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> SMS From Number
          </Label>
          <Input
            value={smsFrom}
            onChange={(e) => setSmsFrom(e.target.value)}
            placeholder="+44... (uses system default if empty)"
            maxLength={20}
          />
          <p className="text-xs text-muted-foreground">
            Your Twilio phone number for SMS. Must be in E.164 format (e.g. +447123456789)
          </p>
        </div>

        {/* WhatsApp From Number */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> WhatsApp From Number
          </Label>
          <Input
            value={whatsappFrom}
            onChange={(e) => setWhatsappFrom(e.target.value)}
            placeholder="+44... (uses system default if empty)"
            maxLength={20}
          />
          <p className="text-xs text-muted-foreground">
            Your Twilio WhatsApp-enabled number. Must be in E.164 format
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Communications Settings
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Main Settings page ─── */
export default function Settings() {
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg sm:text-xl font-display font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage application configuration and options</p>
      </div>

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList className="flex flex-nowrap h-auto gap-1 overflow-x-auto w-full justify-start [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="branding" className="gap-1.5 text-xs"><ImageIcon className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Branding</span></TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5 text-xs"><CreditCard className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Billing</span></TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Notifications</span></TabsTrigger>
          <TabsTrigger value="comms" className="gap-1.5 text-xs"><Mail className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Comms</span></TabsTrigger>
          <TabsTrigger value="units" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Units</span></TabsTrigger>
          <TabsTrigger value="wsf" className="gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" /><span className="hidden sm:inline"> WSF</span></TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5 text-xs"><Church className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Services</span></TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Events</span></TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Training</span></TabsTrigger>
          <TabsTrigger value="pastoral" className="gap-1.5 text-xs"><Heart className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Pastoral</span></TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="certificates" className="gap-1.5 text-xs"><Award className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Certs</span></TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="links" className="gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Links</span></TabsTrigger>
          )}
          <TabsTrigger value="books" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Books</span></TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="danger" className="gap-1.5 text-xs text-destructive"><ShieldAlert className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Danger</span></TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <ChurchBrandingSection />
          <FaviconOgImageSection />
        </TabsContent>

        <TabsContent value="billing">
          <BillingSection />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferencesSection />
        </TabsContent>

        <TabsContent value="comms">
          <CommunicationsSection />
        </TabsContent>

        <TabsContent value="units">
          <ChurchUnitsSection />
        </TabsContent>

        <TabsContent value="wsf" className="space-y-6">
          <WSFZonesSection />
          <WSFCentresSection />
        </TabsContent>

        <TabsContent value="services">
          <SettingsListSection
            settingsKey="service_types"
            title="Service Types"
            icon={Church}
            description="Types of church services for attendance recording"
          />
        </TabsContent>

        <TabsContent value="events">
          <SettingsListSection
            settingsKey="event_categories"
            title="Event Categories"
            icon={CalendarDays}
            description="Categories for church events"
          />
        </TabsContent>

        <TabsContent value="training">
          <SettingsListSection
            settingsKey="training_types"
            title="Training Programme Types"
            icon={TrendingUp}
            description="Church growth programme types for BFC & training reports"
          />
        </TabsContent>

        <TabsContent value="pastoral">
          <SettingsListSection
            settingsKey="pastoral_care_types"
            title="Pastoral Care Types"
            icon={Heart}
            description="Types of pastoral care requests"
          />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="certificates">
            <CertificateTemplateSettings />
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="links">
            <ExternalLinksSection />
          </TabsContent>
        )}

        <TabsContent value="books">
          <BookOfTheMonthSettings />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="danger">
            <DangerZoneSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
