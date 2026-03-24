import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Building2, Users, UserCheck, Plus, CheckCircle2, ArrowRightLeft, Clock, Pencil, Save, Image, Palette } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// All feature modules that can be toggled per tenant
const FEATURE_MODULES = [
  { key: "members", label: "Members", description: "Member directory and management" },
  { key: "events", label: "Events", description: "Event scheduling and registration" },
  { key: "attendance", label: "Attendance", description: "Unit meeting attendance tracking" },
  { key: "followups", label: "Follow-ups", description: "Follow-up task management" },
  { key: "pastoral-care", label: "Pastoral Care", description: "Pastoral care requests and tracking" },
  { key: "communications", label: "Communications", description: "Announcements, email, and messaging" },
  { key: "transportation", label: "Transportation", description: "Transport booking and management" },
  { key: "analytics", label: "Analytics", description: "Attendance and growth analytics" },
  { key: "training-reports", label: "Training Reports", description: "BFC and training progress" },
  { key: "church-attendance", label: "Church Attendance", description: "Sunday service attendance" },
  { key: "exam-management", label: "WoFBI Exams", description: "Exam sessions and results" },
  { key: "wsf", label: "WSF Centres", description: "Winners Satellite Fellowship management" },
  { key: "sms", label: "SMS", description: "SMS messaging capability" },
];

export default function TenantAdmin() {
  const { user } = useAuth();
  const { tenantId, switchTenant, tenantMemberships } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTenant, setEditTenant] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newTenant, setNewTenant] = useState({ name: "", slug: "", timezone: "Europe/London" });

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: tenantStats = {} } = useQuery({
    queryKey: ["tenant-stats"],
    queryFn: async () => {
      const stats = {};
      for (const t of tenants) {
        const [{ count: memberCount }, { count: userCount }] = await Promise.all([
          supabase.from("members").select("*", { count: "exact", head: true }).eq("tenant_id", t.id),
          supabase.from("tenant_memberships").select("*", { count: "exact", head: true }).eq("tenant_id", t.id),
        ]);
        stats[t.id] = { members: memberCount || 0, users: userCount || 0 };
      }
      return stats;
    },
    enabled: tenants.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from("tenants").insert({
        name: payload.name,
        slug: payload.slug,
        timezone: payload.timezone,
        created_by: user.id,
        setup_complete: true,
      }).select().single();
      if (error) throw error;
      await supabase.from("tenant_memberships").insert({
        user_id: user.id,
        tenant_id: data.id,
        role: "owner",
      });
      return data;
    },
    onSuccess: () => {
      toast({ title: "Tenant created successfully" });
      setCreateOpen(false);
      setNewTenant({ name: "", slug: "", timezone: "Europe/London" });
      queryClient.invalidateQueries({ queryKey: ["tenants-admin"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (err) => {
      toast({ title: "Error creating tenant", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { error } = await supabase.from("tenants").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Tenant updated successfully" });
      setEditTenant(null);
      queryClient.invalidateQueries({ queryKey: ["tenants-admin"] });
    },
    onError: (err) => {
      toast({ title: "Error updating tenant", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.slug) return;
    createMutation.mutate(newTenant);
  };

  const handleSwitch = (tid) => {
    switchTenant(tid);
    toast({ title: "Switched tenant context" });
  };

  const openEdit = (tenant) => {
    const settings = tenant.settings || {};
    setEditTenant(tenant);
    setEditForm({
      name: tenant.name,
      slug: tenant.slug,
      timezone: tenant.timezone,
      logo_url: tenant.logo_url || "",
      setup_complete: tenant.setup_complete,
      // Feature flags from settings
      disabled_features: settings.disabled_features || [],
      primary_color: settings.primary_color || "",
      welcome_message: settings.welcome_message || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editTenant) return;
    const { name, slug, timezone, logo_url, setup_complete, disabled_features, primary_color, welcome_message } = editForm;
    const settings = {
      ...(editTenant.settings || {}),
      disabled_features,
      primary_color: primary_color || undefined,
      welcome_message: welcome_message || undefined,
    };
    updateMutation.mutate({
      id: editTenant.id,
      name,
      slug,
      timezone,
      logo_url: logo_url || null,
      setup_complete,
      settings,
    });
  };

  const toggleFeature = (featureKey) => {
    const current = editForm.disabled_features || [];
    const path = `/${featureKey}`;
    setEditForm({
      ...editForm,
      disabled_features: current.includes(path)
        ? current.filter(f => f !== path)
        : [...current, path],
    });
  };

  const autoSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tenants.length}</p>
              <p className="text-xs text-muted-foreground">Total Tenants</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <Users className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {Object.values(tenantStats).reduce((s, v) => s + v.members, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <UserCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {Object.values(tenantStats).reduce((s, v) => s + v.users, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Tenants</CardTitle>
            <CardDescription>Manage church tenants and switch context</CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Tenant</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Tenant</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Church Name</Label>
                  <Input
                    value={newTenant.name}
                    onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value, slug: autoSlug(e.target.value) })}
                    placeholder="e.g. Winners Chapel London"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input
                    value={newTenant.slug}
                    onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value })}
                    placeholder="e.g. wci-london"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Used in URLs: /t/{newTenant.slug || "slug"}/</p>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input
                    value={newTenant.timezone}
                    onChange={(e) => setNewTenant({ ...newTenant, timezone: e.target.value })}
                    placeholder="Europe/London"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Tenant"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-4">Loading tenants...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Slug</TableHead>
                    <TableHead className="hidden md:table-cell">Timezone</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead className="text-center">Users</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((t) => {
                    const isActive = tenantId === t.id;
                    const stats = tenantStats[t.id] || { members: 0, users: 0 };
                    const isMember = tenantMemberships.some(m => m.tenant_id === t.id);
                    return (
                      <TableRow key={t.id} className={isActive ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {t.logo_url && <img src={t.logo_url} alt="" className="h-6 w-6 rounded object-contain" />}
                            <div>
                              <span>{t.name}</span>
                              {isActive && <Badge variant="secondary" className="ml-2 text-[10px]">Active</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.slug}</code>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />{t.timezone}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{stats.members}</TableCell>
                        <TableCell className="text-center">{stats.users}</TableCell>
                        <TableCell>
                          {t.setup_complete ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Setup</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            {isMember && !isActive && (
                              <Button size="sm" variant="outline" onClick={() => handleSwitch(t.id)}>
                                <ArrowRightLeft className="h-3 w-3 mr-1" /> Switch
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Tenant Dialog */}
      <Dialog open={!!editTenant} onOpenChange={(open) => !open && setEditTenant(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tenant: {editTenant?.name}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Church Name</Label>
                <Input
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>URL Slug</Label>
                <Input
                  value={editForm.slug || ""}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Used in URLs: /t/{editForm.slug || "slug"}/</p>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={editForm.timezone || ""}
                  onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Setup Complete</Label>
                  <p className="text-xs text-muted-foreground">Mark as fully configured</p>
                </div>
                <Switch
                  checked={editForm.setup_complete || false}
                  onCheckedChange={(v) => setEditForm({ ...editForm, setup_complete: v })}
                />
              </div>
            </TabsContent>

            {/* Branding Tab */}
            <TabsContent value="branding" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Image className="h-3.5 w-3.5" /> Logo URL</Label>
                <Input
                  value={editForm.logo_url || ""}
                  onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
                {editForm.logo_url && (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <img src={editForm.logo_url} alt="Logo preview" className="h-12 w-12 object-contain rounded" />
                    <span className="text-xs text-muted-foreground">Logo preview</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    value={editForm.primary_color || ""}
                    onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })}
                    placeholder="#1a2d4d"
                    className="flex-1"
                  />
                  {editForm.primary_color && (
                    <div className="h-9 w-9 rounded border" style={{ backgroundColor: editForm.primary_color }} />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Welcome Message</Label>
                <Textarea
                  value={editForm.welcome_message || ""}
                  onChange={(e) => setEditForm({ ...editForm, welcome_message: e.target.value })}
                  placeholder="Welcome to our church management platform..."
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features" className="space-y-1 mt-4">
              <p className="text-xs text-muted-foreground mb-3">Toggle modules on/off for this tenant. Disabled modules won't appear in navigation.</p>
              {FEATURE_MODULES.map((f) => {
                const path = `/${f.key}`;
                const isDisabled = (editForm.disabled_features || []).includes(path);
                return (
                  <div key={f.key} className="flex items-center justify-between py-2.5 px-1">
                    <div>
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <Switch
                      checked={!isDisabled}
                      onCheckedChange={() => toggleFeature(f.key)}
                    />
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>

          <Separator className="my-2" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTenant(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
