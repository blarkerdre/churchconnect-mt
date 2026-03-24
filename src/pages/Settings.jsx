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
  Users, Church, CalendarDays, TrendingUp, Heart, Globe, Bell, Award, Link2, ToggleLeft, ShieldAlert, BookOpen
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import WSFCentresSection from "@/components/settings/WSFCentresSection";
import WSFZonesSection from "@/components/settings/WSFZonesSection";
import CertificateTemplateSettings from "@/components/certificates/CertificateTemplateSettings";
import ExternalLinksSection from "@/components/settings/ExternalLinksSection";
import DangerZoneSection from "@/components/settings/DangerZoneSection";
import BookOfTheMonthSettings from "@/components/settings/BookOfTheMonthSettings";

/* ─── Notification Preferences section ─── */
function NotificationPreferencesSection() {
  const qc = useQueryClient();
  
  const { data: smsEnabled, isLoading } = useQuery({
    queryKey: ["app-settings", "sms_notifications_enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "sms_notifications_enabled")
        .maybeSingle();
      if (error) throw error;
      // Default to true (email + SMS) if not set
      return data?.value === true || data?.value === null || data === null;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "sms_notifications_enabled", value: enabled }, { onConflict: "key" });
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

/* ─── Reusable list section backed by app_settings ─── */
function SettingsListSection({ settingsKey, title, icon: Icon, description }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [itemName, setItemName] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["app-settings", settingsKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", settingsKey)
        .maybeSingle();
      if (error) throw error;
      return Array.isArray(data?.value) ? data.value : [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newItems) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: settingsKey, value: newItems }, { onConflict: "key" });
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitName, setUnitName] = useState("");
  const [unitActive, setUnitActive] = useState(true);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["church-units", false],
    queryFn: async () => {
      const { data, error } = await supabase.from("church_units").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, is_active }) => {
      if (id) {
        const { error } = await supabase.from("church_units").update({ name, is_active }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("church_units").insert({ name, is_active });
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
      const { error } = await supabase.from("church_units").delete().eq("id", id);
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

/* ─── Feature Toggles section (super admin only) ─── */
const TOGGLEABLE_FEATURES = [
  { path: "/members", name: "Members" },
  { path: "/events", name: "Events" },
  { path: "/attendance", name: "Unit Attendance" },
  { path: "/followups", name: "Follow-ups" },
  { path: "/pastoral-care", name: "Pastoral Care" },
  { path: "/communications", name: "Communications" },
  { path: "/transportation", name: "Transportation" },
  { path: "/analytics", name: "Analytics" },
  { path: "/training-reports", name: "BFC & Training Report" },
  { path: "/church-attendance", name: "Church Attendance" },
  { path: "/exam-management", name: "WoFBI" },
  { path: "/wsf", name: "WSF Centres" },
];

function FeatureTogglesSection() {
  const qc = useQueryClient();

  const { data: disabledFeatures = [], isLoading } = useQuery({
    queryKey: ["app-settings", "disabled_features"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "disabled_features")
        .maybeSingle();
      if (error) throw error;
      return Array.isArray(data?.value) ? data.value : [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (newDisabled) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "disabled_features", value: newDisabled }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-settings", "disabled_features"] });
      toast({ title: "Feature visibility updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleToggle = (path, enabled) => {
    const updated = enabled
      ? disabledFeatures.filter((p) => p !== path)
      : [...disabledFeatures, path];
    toggleMutation.mutate(updated);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <ToggleLeft className="h-4 w-4 text-accent" /> Feature Toggles
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Enable or disable app modules. Disabled features are hidden from all users except super admins.</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {TOGGLEABLE_FEATURES.map((feature) => {
              const isEnabled = !disabledFeatures.includes(feature.path);
              return (
                <div key={feature.path} className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">{feature.name}</p>
                    <p className="text-[11px] text-muted-foreground">{feature.path}</p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(feature.path, checked)}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              );
            })}
          </div>
        )}
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

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList className="flex flex-nowrap h-auto gap-1 overflow-x-auto w-full justify-start [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <TabsTrigger value="notifications" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Notifications</span></TabsTrigger>
          <TabsTrigger value="units" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Units</span></TabsTrigger>
          <TabsTrigger value="wsf" className="gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" /><span className="hidden sm:inline"> WSF</span></TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5 text-xs"><Church className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Services</span></TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 text-xs"><CalendarDays className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Events</span></TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Training</span></TabsTrigger>
          <TabsTrigger value="pastoral" className="gap-1.5 text-xs"><Heart className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Pastoral</span></TabsTrigger>
          <TabsTrigger value="certificates" className="gap-1.5 text-xs"><Award className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Certs</span></TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Links</span></TabsTrigger>
          <TabsTrigger value="books" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Books</span></TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="features" className="gap-1.5 text-xs"><ToggleLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Features</span></TabsTrigger>
          )}
          {isSuperAdmin && (
            <TabsTrigger value="danger" className="gap-1.5 text-xs text-destructive"><ShieldAlert className="h-3.5 w-3.5" /><span className="hidden sm:inline"> Danger</span></TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="notifications">
          <NotificationPreferencesSection />
        </TabsContent>

        <TabsContent value="units">
          <ChurchUnitsSection />
        </TabsContent>

        <TabsContent value="wsf">
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

        <TabsContent value="certificates">
          <CertificateTemplateSettings />
        </TabsContent>

        <TabsContent value="links">
          <ExternalLinksSection />
        </TabsContent>

        <TabsContent value="books">
          <BookOfTheMonthSettings />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="features">
            <FeatureTogglesSection />
          </TabsContent>
        )}
        {isSuperAdmin && (
          <TabsContent value="danger">
            <DangerZoneSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
