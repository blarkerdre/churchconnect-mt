import React, { useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import {
  Settings as SettingsIcon, Plus, Pencil, Trash2, Loader2,
  Users, Church, CalendarDays, TrendingUp, Heart, Globe, Bell, Award, Link2, ShieldAlert, Upload, X, ImageIcon, Mail, Phone, CreditCard, Send, Key
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FollowupTemplatesSection from "@/components/settings/FollowupTemplatesSection";
import BirthdayMessagesSection from "@/components/settings/BirthdayMessagesSection";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import WSFCentresSection from "@/components/settings/WSFCentresSection";
import WSFZonesSection from "@/components/settings/WSFZonesSection";
import CertificateTemplateSettings from "@/components/certificates/CertificateTemplateSettings";
import ExternalLinksSection from "@/components/settings/ExternalLinksSection";
import DangerZoneSection from "@/components/settings/DangerZoneSection";

import ConsentPrivacySection from "@/components/settings/ConsentPrivacySection";
import DashboardBannerSettings from "@/components/settings/DashboardBannerSettings";
import ApiKeysSection from "@/components/settings/ApiKeysSection";

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
  const [manageLoading, setManageLoading] = useState(false);

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

  const [showAllPayments, setShowAllPayments] = useState(false);

  const { data: payments = [] } = useQuery({
    queryKey: ["tenant-payments", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("payment_date", { ascending: false })
        .limit(50);
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

  const handleManageSubscription = async () => {
    setManageLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-tenant-subscription", {
        body: { tenant_id: tenantId, action: "portal" },
      });
      if (error) throw new Error(error.message || "Failed to open portal");
      if (!data?.url) throw new Error("Missing portal URL");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setManageLoading(false);
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
              {Number(subscription.setup_fee_amount) > 0 && (
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">Setup Fee (one-time)</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{subscription.currency} {Number(subscription.setup_fee_amount).toFixed(2)}</span>
                    {subscription.setup_fee_paid ? (
                      <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white">Paid</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300">Due with first payment</Badge>
                    )}
                  </span>
                </div>
              )}
            </div>

            {!subscription.stripe_subscription_id && Number(subscription.setup_fee_amount) > 0 && !subscription.setup_fee_paid && (
              <p className="text-xs text-muted-foreground px-1">
                Your first payment will include a one-time setup fee of <span className="font-medium text-foreground">{subscription.currency} {Number(subscription.setup_fee_amount).toFixed(2)}</span> plus the recurring <span className="font-medium text-foreground">{subscription.currency} {Number(subscription.amount).toFixed(2)}</span> / {subscription.billing_cycle}.
              </p>
            )}

            {subscription.stripe_subscription_id && (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-xs text-emerald-700 dark:text-emerald-400">
                <CreditCard className="h-3.5 w-3.5" />
                <span>Auto-renewing via Stripe</span>
              </div>
            )}

            {(isTenantOwner || isTAdmin) && (
              <div className="flex gap-2">
                {subscription.stripe_subscription_id ? (
                  <Button onClick={handleManageSubscription} disabled={manageLoading} className="w-full" variant="outline">
                    {manageLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Opening...</> : <><CreditCard className="h-4 w-4 mr-2" /> Manage Subscription</>}
                  </Button>
                ) : (
                  <Button onClick={handlePayNow} disabled={payLoading} className="w-full">
                    {payLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Redirecting...</> : <><CreditCard className="h-4 w-4 mr-2" /> Subscribe via Stripe</>}
                  </Button>
                )}
              </div>
            )}

            {payments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Payment History</h4>
                  {payments.length > 5 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowAllPayments(!showAllPayments)}>
                      {showAllPayments ? "Show Less" : `View All (${payments.length})`}
                    </Button>
                  )}
                </div>
                <div className={showAllPayments ? "max-h-80 overflow-y-auto" : ""}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Amount</TableHead>
                        <TableHead className="text-xs">Method</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(showAllPayments ? payments : payments.slice(0, 5)).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{p.payment_date}</TableCell>
                          <TableCell className="text-xs font-medium">{p.currency} {Number(p.amount).toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{p.payment_method || "Stripe"}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant={p.status === "completed" ? "default" : p.status === "pending" ? "secondary" : "destructive"} className={`text-[10px] ${p.status === "completed" ? "bg-green-600" : p.status === "pending" ? "bg-amber-500" : ""}`}>
                              {p.status || "completed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[100px]" title={p.reference || p.stripe_payment_intent_id || "—"}>
                            {p.reference || p.stripe_payment_intent_id || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
  const faviconInputRef = React.useRef(null);
  const ogInputRef = React.useRef(null);

  const faviconUrl = currentTenant?.settings?.favicon_url || null;
  const ogImageUrl = currentTenant?.settings?.og_image_url || null;

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

        {/* PWA App Icon — auto-derived from tenant logo */}
        <div className="space-y-1 rounded-md border border-dashed border-border bg-muted/30 p-3">
          <Label className="text-sm font-medium">App Icon (PWA)</Label>
          <p className="text-[11px] text-muted-foreground">
            Your church logo and name are automatically used as the app icon and title when members install this app to their home screen. No separate upload needed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Communications Settings (email sender name + provider config) ─── */
function CommunicationsSection() {
  const qc = useQueryClient();
  const { currentTenant, tenantId } = useTenant();
  const { withTenant } = useTenantQuery();
  const [saving, setSaving] = useState(false);
  const [emailSenderName, setEmailSenderName] = useState("");
  const [smsFrom, setSmsFrom] = useState("");
  const [whatsappFrom, setWhatsappFrom] = useState("");
  const [smsProvider, setSmsProvider] = useState("twilio");
  const [voiceProvider, setVoiceProvider] = useState("twilio");

  // Africa's Talking fields
  const [atApiKey, setAtApiKey] = useState("");
  const [atUsername, setAtUsername] = useState("");
  const [atSenderId, setAtSenderId] = useState("");
  const [atVoiceFrom, setAtVoiceFrom] = useState("");

  // Termii fields
  const [termiiApiKey, setTermiiApiKey] = useState("");
  const [termiiSenderId, setTermiiSenderId] = useState("");

  // Custom SMS provider fields
  const [customSmsName, setCustomSmsName] = useState("");
  const [customSmsEndpoint, setCustomSmsEndpoint] = useState("");
  const [customSmsMethod, setCustomSmsMethod] = useState("POST");
  const [customSmsAuthHeader, setCustomSmsAuthHeader] = useState("");
  const [customSmsAuthValue, setCustomSmsAuthValue] = useState("");
  const [customSmsContentType, setCustomSmsContentType] = useState("application/json");
  const [customSmsBodyTemplate, setCustomSmsBodyTemplate] = useState('{\n  "to": "{{to}}",\n  "message": "{{message}}",\n  "from": "{{from}}"\n}');
  const [customSmsSenderId, setCustomSmsSenderId] = useState("");

  // Custom Voice provider fields
  const [customVoiceName, setCustomVoiceName] = useState("");
  const [customVoiceEndpoint, setCustomVoiceEndpoint] = useState("");
  const [customVoiceMethod, setCustomVoiceMethod] = useState("POST");
  const [customVoiceAuthHeader, setCustomVoiceAuthHeader] = useState("");
  const [customVoiceAuthValue, setCustomVoiceAuthValue] = useState("");
  const [customVoiceContentType, setCustomVoiceContentType] = useState("application/json");
  const [customVoiceBodyTemplate, setCustomVoiceBodyTemplate] = useState('{\n  "to": "{{to}}",\n  "from": "{{from}}"\n}');
  const [customVoiceSenderId, setCustomVoiceSenderId] = useState("");

  // Fetch current month usage
  const { data: msgUsage } = useQuery({
    queryKey: ["msg-usage", tenantId],
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const ms = monthStart.toISOString();
      const [{ count: sms }, { count: wa }] = await Promise.all([
        supabase.from("sms_log").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("channel", "sms").eq("status", "sent").gte("created_at", ms),
        supabase.from("sms_log").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("channel", "whatsapp").eq("status", "sent").gte("created_at", ms),
      ]);
      return { sms: sms || 0, whatsapp: wa || 0 };
    },
    enabled: !!tenantId,
  });

  // Fetch provider-specific credentials from app_settings
  const { data: providerSettings } = useQuery({
    queryKey: ["provider-settings", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("tenant_id", tenantId)
        .in("key", [
          "africastalking_api_key", "africastalking_username", "africastalking_sender_id",
          "termii_api_key", "termii_sender_id",
          "custom_sms_provider_config", "custom_voice_provider_config",
        ]);
      if (error) throw error;
      const map = {};
      (data || []).forEach(r => { map[r.key] = r.value; });
      return map;
    },
    enabled: !!tenantId,
  });

  const settings = currentTenant?.settings || {};

  // Initialize from tenant settings
  React.useEffect(() => {
    if (currentTenant?.settings) {
      const s = currentTenant.settings;
      setEmailSenderName(s.email_sender_name || "");
      setSmsFrom(s.twilio_sms_from || "");
      setWhatsappFrom(s.twilio_whatsapp_from || "");
      setSmsProvider(s.sms_provider || "twilio");
      setVoiceProvider(s.voice_provider || "twilio");
      setAtVoiceFrom(s.africastalking_voice_from || "");
    }
  }, [currentTenant?.settings]);

  React.useEffect(() => {
    if (providerSettings) {
      setAtApiKey(providerSettings.africastalking_api_key || "");
      setAtUsername(providerSettings.africastalking_username || "");
      setAtSenderId(providerSettings.africastalking_sender_id || "");
      setTermiiApiKey(providerSettings.termii_api_key || "");
      setTermiiSenderId(providerSettings.termii_sender_id || "");

      // Custom SMS config
      const csms = providerSettings.custom_sms_provider_config;
      if (csms && typeof csms === "object") {
        setCustomSmsName(csms.name || "");
        setCustomSmsEndpoint(csms.endpoint || "");
        setCustomSmsMethod(csms.method || "POST");
        setCustomSmsAuthHeader(csms.auth_header || "");
        setCustomSmsAuthValue(csms.auth_value || "");
        setCustomSmsContentType(csms.content_type || "application/json");
        setCustomSmsBodyTemplate(csms.body_template || '{\n  "to": "{{to}}",\n  "message": "{{message}}",\n  "from": "{{from}}"\n}');
        setCustomSmsSenderId(csms.sender_id || "");
      }

      // Custom Voice config
      const cvoice = providerSettings.custom_voice_provider_config;
      if (cvoice && typeof cvoice === "object") {
        setCustomVoiceName(cvoice.name || "");
        setCustomVoiceEndpoint(cvoice.endpoint || "");
        setCustomVoiceMethod(cvoice.method || "POST");
        setCustomVoiceAuthHeader(cvoice.auth_header || "");
        setCustomVoiceAuthValue(cvoice.auth_value || "");
        setCustomVoiceContentType(cvoice.content_type || "application/json");
        setCustomVoiceBodyTemplate(cvoice.body_template || '{\n  "to": "{{to}}",\n  "from": "{{from}}"\n}');
        setCustomVoiceSenderId(cvoice.sender_id || "");
      }
    }
  }, [providerSettings]);

  const e164Regex = /^\+[1-9]\d{6,14}$/;

  const handleSave = async () => {
    if (smsProvider === "twilio" && smsFrom && !e164Regex.test(smsFrom.trim())) {
      toast({ title: "Invalid SMS number", description: "Must be E.164 format (e.g. +447123456789)", variant: "destructive" });
      return;
    }
    if (whatsappFrom && !e164Regex.test(whatsappFrom.trim())) {
      toast({ title: "Invalid WhatsApp number", description: "Must be E.164 format (e.g. +447123456789)", variant: "destructive" });
      return;
    }
    if (smsProvider === "custom" && !customSmsEndpoint.trim()) {
      toast({ title: "Custom SMS endpoint URL is required", variant: "destructive" });
      return;
    }
    if (voiceProvider === "custom" && !customVoiceEndpoint.trim()) {
      toast({ title: "Custom Voice endpoint URL is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Save tenant settings
      const mergedSettings = {
        ...(currentTenant?.settings || {}),
        email_sender_name: emailSenderName.trim() || null,
        twilio_sms_from: smsFrom.trim() || null,
        twilio_whatsapp_from: whatsappFrom.trim() || null,
        sms_provider: smsProvider,
        voice_provider: voiceProvider,
        africastalking_voice_from: atVoiceFrom.trim() || null,
      };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: mergedSettings })
        .eq("id", tenantId);
      if (error) throw error;

      // Save provider credentials to app_settings
      const credentialPairs = [];
      if (smsProvider === "africastalking" || voiceProvider === "africastalking") {
        credentialPairs.push(
          { key: "africastalking_api_key", value: atApiKey.trim() || null },
          { key: "africastalking_username", value: atUsername.trim() || null },
          { key: "africastalking_sender_id", value: atSenderId.trim() || null },
        );
      }
      if (smsProvider === "termii") {
        credentialPairs.push(
          { key: "termii_api_key", value: termiiApiKey.trim() || null },
          { key: "termii_sender_id", value: termiiSenderId.trim() || null },
        );
      }
      if (smsProvider === "custom") {
        credentialPairs.push({
          key: "custom_sms_provider_config",
          value: {
            name: customSmsName.trim(),
            endpoint: customSmsEndpoint.trim(),
            method: customSmsMethod,
            auth_header: customSmsAuthHeader.trim(),
            auth_value: customSmsAuthValue.trim(),
            content_type: customSmsContentType,
            body_template: customSmsBodyTemplate,
            sender_id: customSmsSenderId.trim(),
          },
        });
      }
      if (voiceProvider === "custom") {
        credentialPairs.push({
          key: "custom_voice_provider_config",
          value: {
            name: customVoiceName.trim(),
            endpoint: customVoiceEndpoint.trim(),
            method: customVoiceMethod,
            auth_header: customVoiceAuthHeader.trim(),
            auth_value: customVoiceAuthValue.trim(),
            content_type: customVoiceContentType,
            body_template: customVoiceBodyTemplate,
            sender_id: customVoiceSenderId.trim(),
          },
        });
      }

      for (const pair of credentialPairs) {
        await supabase
          .from("app_settings")
          .upsert(withTenant(pair), { onConflict: "key,tenant_id" });
      }

      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["provider-settings"] });
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
          Configure email sender, SMS/Voice providers, and phone numbers.
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
            Appears as the "From" name in outgoing emails
          </p>
        </div>

        {/* SMS Provider */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">SMS Provider</Label>
          <Select value={smsProvider} onValueChange={setSmsProvider}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="twilio">Twilio</SelectItem>
              <SelectItem value="africastalking">Africa's Talking</SelectItem>
              <SelectItem value="termii">Termii</SelectItem>
              <SelectItem value="custom">Custom Provider</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Voice Call Provider */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Voice Call Provider</Label>
          <Select value={voiceProvider} onValueChange={setVoiceProvider}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="twilio">Twilio</SelectItem>
              <SelectItem value="africastalking">Africa's Talking</SelectItem>
              <SelectItem value="custom">Custom Provider</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Twilio fields */}
        {(smsProvider === "twilio" || voiceProvider === "twilio") && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground">Twilio Settings</p>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> SMS From Number
              </Label>
              <Input
                value={smsFrom}
                onChange={(e) => setSmsFrom(e.target.value)}
                placeholder="+44... (uses system default if empty)"
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> WhatsApp From Number
              </Label>
              <Input
                value={whatsappFrom}
                onChange={(e) => setWhatsappFrom(e.target.value)}
                placeholder="+44... (uses system default if empty)"
                maxLength={20}
              />
            </div>
          </div>
        )}

        {/* Africa's Talking fields */}
        {(smsProvider === "africastalking" || voiceProvider === "africastalking") && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground">Africa's Talking Settings</p>
            <div className="space-y-2">
              <Label className="text-sm">Username</Label>
              <Input value={atUsername} onChange={(e) => setAtUsername(e.target.value)} placeholder="sandbox or production username" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">API Key</Label>
              <Input value={atApiKey} onChange={(e) => setAtApiKey(e.target.value)} placeholder="Your Africa's Talking API key" type="password" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Sender ID / Short Code</Label>
              <Input value={atSenderId} onChange={(e) => setAtSenderId(e.target.value)} placeholder="e.g. MyChurch or short code" />
              <p className="text-xs text-muted-foreground">Leave blank for default sender</p>
            </div>
            {voiceProvider === "africastalking" && (
              <div className="space-y-2">
                <Label className="text-sm">Voice From Number</Label>
                <Input value={atVoiceFrom} onChange={(e) => setAtVoiceFrom(e.target.value)} placeholder="Your Africa's Talking phone number" />
              </div>
            )}
          </div>
        )}

        {/* Termii fields */}
        {smsProvider === "termii" && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground">Termii Settings</p>
            <div className="space-y-2">
              <Label className="text-sm">API Key</Label>
              <Input value={termiiApiKey} onChange={(e) => setTermiiApiKey(e.target.value)} placeholder="Your Termii API key" type="password" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Sender ID</Label>
              <Input value={termiiSenderId} onChange={(e) => setTermiiSenderId(e.target.value)} placeholder="e.g. MyChurch" />
            </div>
          </div>
        )}

        {/* Custom SMS Provider fields */}
        {smsProvider === "custom" && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground">Custom SMS Provider</p>
            <div className="space-y-2">
              <Label className="text-sm">Provider Name</Label>
              <Input value={customSmsName} onChange={(e) => setCustomSmsName(e.target.value)} placeholder="e.g. BulkSMS, Vonage, SMSLive247" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">API Endpoint URL</Label>
              <Input value={customSmsEndpoint} onChange={(e) => setCustomSmsEndpoint(e.target.value)} placeholder="https://api.provider.com/sms/send" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">HTTP Method</Label>
                <Select value={customSmsMethod} onValueChange={setCustomSmsMethod}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Content Type</Label>
                <Select value={customSmsContentType} onValueChange={setCustomSmsContentType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="application/json">JSON</SelectItem>
                    <SelectItem value="application/x-www-form-urlencoded">Form Encoded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Auth Header Name</Label>
              <Input value={customSmsAuthHeader} onChange={(e) => setCustomSmsAuthHeader(e.target.value)} placeholder="e.g. Authorization, apiKey, X-API-Key" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Auth Header Value</Label>
              <Input value={customSmsAuthValue} onChange={(e) => setCustomSmsAuthValue(e.target.value)} placeholder="e.g. Bearer your-api-key" type="password" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Sender ID / From Number</Label>
              <Input value={customSmsSenderId} onChange={(e) => setCustomSmsSenderId(e.target.value)} placeholder="e.g. MyChurch" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Request Body Template</Label>
              <Textarea
                value={customSmsBodyTemplate}
                onChange={(e) => setCustomSmsBodyTemplate(e.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder='{"to": "{{to}}", "message": "{{message}}", "from": "{{from}}"}'
              />
              <p className="text-xs text-muted-foreground">
                Use placeholders: <code className="bg-muted px-1 rounded">{"{{to}}"}</code>, <code className="bg-muted px-1 rounded">{"{{message}}"}</code>, <code className="bg-muted px-1 rounded">{"{{from}}"}</code>
              </p>
            </div>
          </div>
        )}

        {/* Custom Voice Provider fields */}
        {voiceProvider === "custom" && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground">Custom Voice Provider</p>
            <div className="space-y-2">
              <Label className="text-sm">Provider Name</Label>
              <Input value={customVoiceName} onChange={(e) => setCustomVoiceName(e.target.value)} placeholder="e.g. Vonage, Plivo" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">API Endpoint URL</Label>
              <Input value={customVoiceEndpoint} onChange={(e) => setCustomVoiceEndpoint(e.target.value)} placeholder="https://api.provider.com/calls" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">HTTP Method</Label>
                <Select value={customVoiceMethod} onValueChange={setCustomVoiceMethod}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="GET">GET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Content Type</Label>
                <Select value={customVoiceContentType} onValueChange={setCustomVoiceContentType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="application/json">JSON</SelectItem>
                    <SelectItem value="application/x-www-form-urlencoded">Form Encoded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Auth Header Name</Label>
              <Input value={customVoiceAuthHeader} onChange={(e) => setCustomVoiceAuthHeader(e.target.value)} placeholder="e.g. Authorization" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Auth Header Value</Label>
              <Input value={customVoiceAuthValue} onChange={(e) => setCustomVoiceAuthValue(e.target.value)} placeholder="e.g. Bearer your-api-key" type="password" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Sender ID / From Number</Label>
              <Input value={customVoiceSenderId} onChange={(e) => setCustomVoiceSenderId(e.target.value)} placeholder="Your caller ID" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Request Body Template</Label>
              <Textarea
                value={customVoiceBodyTemplate}
                onChange={(e) => setCustomVoiceBodyTemplate(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                placeholder='{"to": "{{to}}", "from": "{{from}}"}'
              />
              <p className="text-xs text-muted-foreground">
                Use placeholders: <code className="bg-muted px-1 rounded">{"{{to}}"}</code>, <code className="bg-muted px-1 rounded">{"{{from}}"}</code>
              </p>
            </div>
          </div>
        )}

        {/* Message Usage */}
        {msgUsage && (currentTenant?.sms_limit_monthly > 0 || currentTenant?.whatsapp_limit_monthly > 0) && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <p className="text-xs font-medium text-muted-foreground">Monthly Message Usage</p>
            {currentTenant?.sms_limit_monthly > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>SMS</span>
                  <span>{msgUsage.sms}/{currentTenant.sms_limit_monthly}</span>
                </div>
                <Progress value={Math.min(Math.round((msgUsage.sms / currentTenant.sms_limit_monthly) * 100), 100)} className="h-2" />
              </div>
            )}
            {currentTenant?.whatsapp_limit_monthly > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>WhatsApp</span>
                  <span>{msgUsage.whatsapp}/{currentTenant.whatsapp_limit_monthly}</span>
                </div>
                <Progress value={Math.min(Math.round((msgUsage.whatsapp / currentTenant.whatsapp_limit_monthly) * 100), 100)} className="h-2" />
              </div>
            )}
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Communications Settings
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── Testimony Email Recipient ─── */
function TestimonyEmailSection() {
  const qc = useQueryClient();
  const { tenantId, withTenant } = useTenantQuery();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: currentEmail, isLoading } = useQuery({
    queryKey: ["app-settings", "testimony_recipient_email", tenantId],
    queryFn: async () => {
      let q = supabase.from("app_settings").select("value").eq("key", "testimony_recipient_email");
      if (tenantId) q = q.eq("tenant_id", tenantId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return typeof data?.value === "string" ? data.value : "";
    },
    enabled: !!tenantId,
  });

  React.useEffect(() => {
    if (currentEmail !== undefined) setEmail(currentEmail);
  }, [currentEmail]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert(withTenant({ key: "testimony_recipient_email", value: email.trim() || null }), { onConflict: "key,tenant_id" });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["app-settings", "testimony_recipient_email"] });
      toast({ title: "Testimony recipient email saved" });
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
          <Heart className="h-4 w-4 text-accent" /> Testimony Settings
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Set the email address where member testimonies will be sent.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Testimony Recipient Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pastor@example.com"
            maxLength={255}
          />
          <p className="text-xs text-muted-foreground">
            Testimonies submitted by members will be emailed to this address.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || isLoading} size="sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save
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
          <TabsTrigger value="wsf" className="gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Home Cell</span></TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5 text-xs"><Church className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Services</span></TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Events</span></TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Training</span></TabsTrigger>
          <TabsTrigger value="pastoral" className="gap-1.5 text-xs"><Heart className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Pastoral</span></TabsTrigger>
          <TabsTrigger value="followup-templates" className="gap-1.5 text-xs"><Send className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Follow-ups</span></TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="certificates" className="gap-1.5 text-xs"><Award className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Certs</span></TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="links" className="gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Links</span></TabsTrigger>
          )}
          <TabsTrigger value="consent" className="gap-1.5 text-xs"><ShieldAlert className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Consent</span></TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5 text-xs"><Key className="h-3.5 w-3.5" /><span className="hidden sm:inline"> API</span></TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="danger" className="gap-1.5 text-xs text-destructive"><ShieldAlert className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Danger</span></TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <ChurchBrandingSection />
          <FaviconOgImageSection />
          <DashboardBannerSettings />
        </TabsContent>

        <TabsContent value="billing">
          <BillingSection />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferencesSection />
        </TabsContent>

        <TabsContent value="comms" className="space-y-4">
          <CommunicationsSection />
          <TestimonyEmailSection />
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

        <TabsContent value="followup-templates">
          <FollowupTemplatesSection />
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

        <TabsContent value="consent">
          <ConsentPrivacySection />
        </TabsContent>

        <TabsContent value="api">
          <ApiKeysSection />
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
