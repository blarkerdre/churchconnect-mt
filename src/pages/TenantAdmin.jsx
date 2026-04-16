import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { getEnvironmentLabel } from "@/lib/environment";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertTitle, AlertDescription as AlertDesc } from "@/components/ui/alert";
import {
  Building2, Users, UserCheck, Plus, CheckCircle2, ArrowRightLeft, Clock, Pencil, Save,
  Image, Palette, Users2, Archive, ArchiveRestore, Trash2, BarChart3, AlertTriangle,
  ShieldAlert, Eye, Skull, Link, Copy, ExternalLink, Mail, Share2, Lock,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import TenantUsersDialog from "@/components/tenants/TenantUsersDialog";
import TenantAnalyticsTab from "@/components/tenants/TenantAnalyticsTab";
import TenantBillingTab from "@/components/tenants/TenantBillingTab";

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
  { key: "exam-management", label: "Bible School", description: "Exam sessions and results" },
  { key: "wsf", label: "Home Cell Centres", description: "Home Cell Fellowship management" },
  { key: "sms", label: "SMS", description: "SMS messaging capability" },
  { key: "sermon-notes", label: "Sermon Notes", description: "Sermon notes management" },
  { key: "testimony", label: "Testimony", description: "Member testimony sharing" },
];

const PLAN_TIERS = [
  { value: "free", label: "Free", memberLimit: 100, storageLimit: 500, smsLimit: 50, whatsappLimit: 50 },
  { value: "starter", label: "Starter", memberLimit: 500, storageLimit: 2000, smsLimit: 500, whatsappLimit: 500 },
  { value: "growth", label: "Growth", memberLimit: 2000, storageLimit: 5000, smsLimit: 2000, whatsappLimit: 2000 },
  { value: "enterprise", label: "Enterprise", memberLimit: 10000, storageLimit: 20000, smsLimit: 0, whatsappLimit: 0 },
];

const DATA_TABLES_FOR_COUNTS = [
  { table: "members", label: "Members" },
  { table: "attendance_sessions", label: "Attendance Sessions" },
  { table: "attendance_records", label: "Attendance Records" },
  { table: "events", label: "Events" },
  { table: "event_registrations", label: "Event Registrations" },
  { table: "followups", label: "Follow-ups" },
  { table: "first_timers", label: "First Timers" },
  { table: "pastoral_care", label: "Pastoral Care Cases" },
  { table: "announcements", label: "Announcements" },
  { table: "messages", label: "Messages" },
  { table: "notifications", label: "Notifications" },
  { table: "exam_attempts", label: "Exam Attempts" },
  { table: "documents", label: "Documents" },
  { table: "church_attendance_reports", label: "Church Reports" },
];

export default function TenantAdmin() {
  const { user } = useAuth();
  const { tenantId, switchTenant, tenantMemberships, currentTenant, tenantRole, refreshTenantContext } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTenant, setEditTenant] = useState(null);
  const [usersTenant, setUsersTenant] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [newTenant, setNewTenant] = useState({ name: "", slug: "", timezone: "Europe/London" });
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteStep, setDeleteStep] = useState(1); // 1=warning, 2=confirm text, 3=password
  const [deleteTenant, setDeleteTenant] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [restoreTenant, setRestoreTenant] = useState(null);
  const [archiveTenant, setArchiveTenant] = useState(null);
  const [archivePassword, setArchivePassword] = useState("");
  const [viewDataTenant, setViewDataTenant] = useState(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardEmail, setOnboardEmail] = useState("");
  const [switchTarget, setSwitchTarget] = useState(null); // { id, name, slug }
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchLoading, setSwitchLoading] = useState(false);

  const onboardUrl = `${window.location.origin}/onboard`;

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied to clipboard` });
  };
  const { data: queryTenants = [], isLoading, error: tenantsError } = useQuery({
    queryKey: ["tenants-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Merge: direct query is source of truth once loaded; fallback only while loading/errored
  const tenants = useMemo(() => {
    if (!isLoading && !tenantsError) return queryTenants;
    const map = new Map();
    tenantMemberships?.forEach(m => {
      if (m.tenants && !map.has(m.tenants.id)) map.set(m.tenants.id, m.tenants);
    });
    if (currentTenant && !map.has(currentTenant.id)) map.set(currentTenant.id, currentTenant);
    return [...map.values()];
  }, [isLoading, tenantsError, queryTenants, tenantMemberships, currentTenant]);

  const { data: tenantStats = {} } = useQuery({
    queryKey: ["tenant-stats", tenants.map(t => t.id).join(",")],
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

  // Detailed data counts for a specific tenant
  const { data: detailedCounts, isLoading: countsLoading } = useQuery({
    queryKey: ["tenant-data-counts", viewDataTenant?.id],
    queryFn: async () => {
      if (!viewDataTenant) return null;
      const results = {};
      const promises = DATA_TABLES_FOR_COUNTS.map(async ({ table, label }) => {
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("tenant_id", viewDataTenant.id);
        results[table] = { label, count: count || 0 };
      });
      await Promise.all(promises);
      return results;
    },
    enabled: !!viewDataTenant,
  });

  const activeTenants = tenants.filter(t => !t.is_archived);
  const archivedTenants = tenants.filter(t => t.is_archived);
  const envLabel = getEnvironmentLabel();
  const usingFallback = queryTenants.length === 0 && tenants.length > 0;

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
      // Use SECURITY DEFINER RPC to create owner membership + admin role (bypasses RLS)
      const { error: rpcError } = await supabase.rpc("create_tenant_owner", {
        p_tenant_id: data.id,
        p_user_id: user.id,
      });
      if (rpcError) {
        console.error("Failed to create tenant owner:", rpcError);
        throw new Error("Tenant created but ownership assignment failed: " + rpcError.message);
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Tenant created successfully" });
      setCreateOpen(false);
      setNewTenant({ name: "", slug: "", timezone: "Europe/London" });
      queryClient.invalidateQueries({ queryKey: ["tenants-admin"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-stats"] });
      refreshTenantContext?.();
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

  const archiveMutation = useMutation({
    mutationFn: async ({ tenantId: tid, action, password: pwd }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const body = { tenant_id: tid, action };
      if (pwd) body.password = pwd;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/archive-tenant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: async (_, vars) => {
      const actionLabel = vars.action === "archive" ? "archived" : vars.action === "restore" ? "restored" : "permanently deleted";
      toast({ title: `Tenant ${actionLabel} successfully` });
      resetDeleteState();
      setRestoreTenant(null);
      setArchiveTenant(null);
      setArchivePassword("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenants-admin"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant-analytics"] }),
        refreshTenantContext(),
      ]);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetDeleteState = () => {
    setDeleteTenant(null);
    setDeleteConfirmText("");
    setDeletePassword("");
    setDeleteStep(1);
  };

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
      plan_tier: tenant.plan_tier || "free",
      member_limit: tenant.member_limit || 100,
      storage_limit_mb: tenant.storage_limit_mb || 500,
      sms_limit_monthly: tenant.sms_limit_monthly || 0,
      whatsapp_limit_monthly: tenant.whatsapp_limit_monthly || 0,
      disabled_features: settings.disabled_features || [],
      primary_color: settings.primary_color || "",
      welcome_message: settings.welcome_message || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editTenant) return;
    const { name, slug, timezone, logo_url, setup_complete, plan_tier, member_limit, storage_limit_mb, sms_limit_monthly, whatsapp_limit_monthly, disabled_features, primary_color, welcome_message } = editForm;
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
      plan_tier,
      member_limit: parseInt(member_limit) || 100,
      storage_limit_mb: parseInt(storage_limit_mb) || 500,
      sms_limit_monthly: parseInt(sms_limit_monthly) || 0,
      whatsapp_limit_monthly: parseInt(whatsapp_limit_monthly) || 0,
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

  const handlePlanChange = (tier) => {
    const plan = PLAN_TIERS.find(p => p.value === tier);
    setEditForm({
      ...editForm,
      plan_tier: tier,
      member_limit: plan?.memberLimit || editForm.member_limit,
      storage_limit_mb: plan?.storageLimit || editForm.storage_limit_mb,
      sms_limit_monthly: plan?.smsLimit ?? editForm.sms_limit_monthly,
      whatsapp_limit_monthly: plan?.whatsappLimit ?? editForm.whatsapp_limit_monthly,
    });
  };

  const autoSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const deleteConfirmPhrase = deleteTenant ? `PERMANENTLY DELETE ${deleteTenant.slug}` : "";

  return (
    <div className="space-y-6">
      {/* Super Admin Banner */}
      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">Super Admin Only</AlertTitle>
        <AlertDesc className="text-amber-700 dark:text-amber-300 text-xs">
          Changes here affect all tenants and their data. Proceed with caution.
        </AlertDesc>
      </Alert>

      {/* Environment & Context Info */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={envLabel === "Preview" ? "secondary" : "default"}>{envLabel}</Badge>
        {currentTenant && <span className="text-muted-foreground">Current: <strong>{currentTenant.name}</strong></span>}
        {tenantRole && <Badge variant="outline" className="text-xs">{tenantRole}</Badge>}
      </div>

      {usingFallback && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Showing tenants from your memberships (direct query returned empty). </span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => queryClient.invalidateQueries({ queryKey: ["tenants-admin"] })}>
            Retry
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeTenants.length}</p>
              <p className="text-xs text-muted-foreground">Active Tenants</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-600" />
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
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {Object.values(tenantStats).reduce((s, v) => s + v.users, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Archive className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{archivedTenants.length}</p>
              <p className="text-xs text-muted-foreground">Archived</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="tenants">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="h-3.5 w-3.5 mr-1" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle>All Tenants</CardTitle>
                <CardDescription>Manage church tenants and their settings</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {archivedTenants.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setShowArchived(!showArchived)}>
                    <Archive className="h-3.5 w-3.5 mr-1" />
                    {showArchived ? "Hide" : "Show"} Archived ({archivedTenants.length})
                  </Button>
                )}
                <Dialog open={onboardOpen} onOpenChange={setOnboardOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Share2 className="h-4 w-4 mr-1" /> Invite to Onboard</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite New Church to Onboard</DialogTitle>
                      <DialogDescription>Share this link with a new church admin to start their onboarding</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Onboarding URL</Label>
                        <div className="flex gap-2">
                          <code className="flex-1 bg-muted px-3 py-2 rounded text-xs break-all select-all">{onboardUrl}</code>
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(onboardUrl, "Onboarding URL")}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <Label>Send via Email (optional)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            placeholder="admin@church.org"
                            value={onboardEmail}
                            onChange={(e) => setOnboardEmail(e.target.value)}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!onboardEmail}
                            asChild
                          >
                            <a
                              href={`mailto:${onboardEmail}?subject=${encodeURIComponent("You're invited to set up your church on ChurchConnect")}&body=${encodeURIComponent(`Hello,\n\nYou've been invited to set up your church on ChurchConnect. Click the link below to get started:\n\n${onboardUrl}\n\nBest regards`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Mail className="h-3.5 w-3.5 mr-1" /> Send
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Tenant</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Tenant</DialogTitle>
                      <DialogDescription>Add a new church tenant to the platform</DialogDescription>
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
              </div>
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
                        <TableHead className="hidden md:table-cell">Plan</TableHead>
                        <TableHead className="text-center">Members</TableHead>
                        <TableHead className="text-center">Users</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...activeTenants, ...(showArchived ? archivedTenants : [])].map((t) => {
                        const isActive = tenantId === t.id;
                        const stats = tenantStats[t.id] || { members: 0, users: 0 };
                        const isMember = tenantMemberships.some(m => m.tenant_id === t.id);
                        const memberUsage = t.member_limit > 0 ? Math.round((stats.members / t.member_limit) * 100) : 0;
                        return (
                          <TableRow key={t.id} className={`${isActive ? "bg-primary/5" : ""} ${t.is_archived ? "opacity-60" : ""}`}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {t.logo_url && <img src={t.logo_url} alt="" className="h-6 w-6 rounded object-contain" />}
                                <div>
                                  <span>{t.name}</span>
                                  {isActive && <Badge variant="secondary" className="ml-2 text-[10px]">Active</Badge>}
                                  {t.is_archived && <Badge variant="outline" className="ml-2 text-[10px] text-amber-600">Archived</Badge>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.slug}</code>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge variant="outline" className="text-xs capitalize">{t.plan_tier || "free"}</Badge>
                              {memberUsage >= 80 && (
                                <span className="ml-1 text-[10px] text-amber-600">{memberUsage}%</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{stats.members}</TableCell>
                            <TableCell className="text-center">{stats.users}</TableCell>
                            <TableCell>
                              {t.is_archived ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                  <Archive className="h-3 w-3 mr-1" />Archived
                                </Badge>
                              ) : t.setup_complete ? (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Setup</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end flex-wrap">
                                {/* View Data - always available */}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button size="sm" variant="ghost" title="Tenant URLs">
                                      <Link className="h-3 w-3" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80" align="end">
                                    <div className="space-y-3">
                                      <h4 className="font-medium text-sm">Tenant URLs</h4>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Login URL</Label>
                                        <div className="flex gap-1.5">
                                          <code className="flex-1 bg-muted px-2 py-1 rounded text-[11px] break-all">{`${window.location.origin}/t/${t.slug}/auth`}</code>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(`${window.location.origin}/t/${t.slug}/auth`, "Login URL")}>
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">Registration URL</Label>
                                        <div className="flex gap-1.5">
                                          <code className="flex-1 bg-muted px-2 py-1 rounded text-[11px] break-all">{`${window.location.origin}/t/${t.slug}/register`}</code>
                                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => copyToClipboard(`${window.location.origin}/t/${t.slug}/register`, "Registration URL")}>
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                <Button size="sm" variant="ghost" onClick={() => setViewDataTenant(t)} title="View data">
                                  <Eye className="h-3 w-3" />
                                </Button>

                                {t.is_archived ? (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => setRestoreTenant(t)} title="Restore">
                                      <ArchiveRestore className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive"
                                      onClick={() => { setDeleteTenant(t); setDeleteStep(1); }}
                                      title="Permanently delete"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => setUsersTenant(t)} title="Manage users">
                                      <Users2 className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title="Edit settings">
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setArchiveTenant(t); setArchivePassword(""); }} title="Archive">
                                      <Archive className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive"
                                      onClick={() => { setDeleteTenant(t); setDeleteStep(1); }}
                                      title="Permanently delete"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                    {isMember && !isActive && (
                                      <Button size="sm" variant="outline" onClick={() => handleSwitch(t.id)}>
                                        <ArrowRightLeft className="h-3 w-3 mr-1" /> Switch
                                      </Button>
                                    )}
                                  </>
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
        </TabsContent>

        <TabsContent value="analytics">
          <TenantAnalyticsTab tenants={tenants} />
        </TabsContent>
      </Tabs>

      {/* ============ PERMANENT DELETE DIALOG (multi-step) ============ */}
      <Dialog open={!!deleteTenant} onOpenChange={(open) => { if (!open) resetDeleteState(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Skull className="h-5 w-5" />
              Permanently Delete Tenant
            </DialogTitle>
            <DialogDescription>
              You are about to permanently destroy <strong>{deleteTenant?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {deleteStep === 1 && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>This action is irreversible!</AlertTitle>
                <AlertDesc>
                  All of the following data will be permanently destroyed and cannot be recovered:
                </AlertDesc>
              </Alert>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <span>• Members & profiles</span>
                <span>• Attendance records</span>
                <span>• Events & registrations</span>
                <span>• Follow-ups & first timers</span>
                <span>• Pastoral care cases</span>
                <span>• Announcements & messages</span>
                <span>• Exam data & certificates</span>
                <span>• Documents & storage files</span>
                <span>• SMS/WhatsApp logs</span>
                <span>• Email send logs</span>
                <span>• Church reports</span>
                <span>• All user memberships</span>
              </div>
              {deleteTenant && tenantStats[deleteTenant.id] && (
                <div className="flex gap-4 text-sm p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                  <div className="text-center">
                    <p className="text-lg font-bold text-destructive">{tenantStats[deleteTenant.id].members}</p>
                    <p className="text-xs text-muted-foreground">Members</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-destructive">{tenantStats[deleteTenant.id].users}</p>
                    <p className="text-xs text-muted-foreground">Users</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetDeleteState}>Cancel</Button>
                <Button variant="destructive" onClick={() => setDeleteStep(2)}>
                  I understand, continue
                </Button>
              </div>
            </div>
          )}

          {deleteStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">
                  Type <code className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-mono text-xs">{deleteConfirmPhrase}</code> to confirm:
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteConfirmPhrase}
                  className="font-mono text-sm"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setDeleteStep(1); setDeleteConfirmText(""); }}>Back</Button>
                <Button
                  variant="destructive"
                  disabled={deleteConfirmText !== deleteConfirmPhrase}
                  onClick={() => setDeleteStep(3)}
                >
                  Next: Verify Identity
                </Button>
              </div>
            </div>
          )}

          {deleteStep === 3 && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Final verification</AlertTitle>
                <AlertDesc>Enter your account password to confirm this destructive action.</AlertDesc>
              </Alert>
              <div className="space-y-2">
                <Label>Your Password</Label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setDeleteStep(2); setDeletePassword(""); }}>Back</Button>
                <Button
                  variant="destructive"
                  disabled={!deletePassword || archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate({
                    tenantId: deleteTenant.id,
                    action: "delete",
                    password: deletePassword,
                  })}
                >
                  {archiveMutation.isPending ? "Deleting..." : (
                    <><Skull className="h-4 w-4 mr-1" /> Delete Forever</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ ARCHIVE CONFIRMATION DIALOG ============ */}
      <Dialog open={!!archiveTenant} onOpenChange={(open) => { if (!open) { setArchiveTenant(null); setArchivePassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-amber-600" />
              Archive Tenant
            </DialogTitle>
            <DialogDescription>
              Archive <strong>{archiveTenant?.name}</strong>. Members will lose access until restored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Verify your identity</AlertTitle>
              <AlertDesc>Enter your account password to confirm archival.</AlertDesc>
            </Alert>
            <div className="space-y-2">
              <Label>Your Password</Label>
              <Input
                type="password"
                value={archivePassword}
                onChange={(e) => setArchivePassword(e.target.value)}
                placeholder="Enter your password"
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setArchiveTenant(null); setArchivePassword(""); }}>Cancel</Button>
              <Button
                disabled={!archivePassword || archiveMutation.isPending}
                onClick={() => archiveMutation.mutate({
                  tenantId: archiveTenant.id,
                  action: "archive",
                  password: archivePassword,
                })}
              >
                {archiveMutation.isPending ? "Archiving..." : (
                  <><Archive className="h-4 w-4 mr-1" /> Archive Tenant</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ RESTORE CONFIRMATION DIALOG ============ */}
      <Dialog open={!!restoreTenant} onOpenChange={(open) => { if (!open) setRestoreTenant(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArchiveRestore className="h-5 w-5 text-emerald-600" />
              Restore Tenant
            </DialogTitle>
            <DialogDescription>
              Restore <strong>{restoreTenant?.name}</strong> from archive.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This will reactivate the tenant and make it visible to all its users again. All existing data will be accessible.
            </p>
            {restoreTenant && tenantStats[restoreTenant.id] && (
              <div className="flex gap-4 text-sm p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-700">{tenantStats[restoreTenant.id].members}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-700">{tenantStats[restoreTenant.id].users}</p>
                  <p className="text-xs text-muted-foreground">Users</p>
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRestoreTenant(null)}>Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={archiveMutation.isPending}
                onClick={() => archiveMutation.mutate({ tenantId: restoreTenant.id, action: "restore" })}
              >
                {archiveMutation.isPending ? "Restoring..." : "Restore Tenant"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ VIEW DATA DIALOG ============ */}
      <Dialog open={!!viewDataTenant} onOpenChange={(open) => { if (!open) setViewDataTenant(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Tenant Data: {viewDataTenant?.name}
            </DialogTitle>
            <DialogDescription>
              Overview of all data associated with this tenant.
            </DialogDescription>
          </DialogHeader>
          {countsLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading data counts...</p>
          ) : detailedCounts ? (
            <div className="space-y-1 max-h-[50vh] overflow-y-auto">
              {Object.entries(detailedCounts).map(([key, { label, count }]) => (
                <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">{label}</span>
                  <Badge variant={count > 0 ? "secondary" : "outline"} className="text-xs">
                    {count}
                  </Badge>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex items-center justify-between py-1.5 px-2 font-medium">
                <span className="text-sm">Total Records</span>
                <Badge className="text-xs">
                  {Object.values(detailedCounts).reduce((s, { count }) => s + count, 0)}
                </Badge>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={!!editTenant} onOpenChange={(open) => !open && setEditTenant(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tenant: {editTenant?.name}</DialogTitle>
            <DialogDescription>Modify tenant settings, branding, plan, and features</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="branding">Branding</TabsTrigger>
              <TabsTrigger value="plan">Plan</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
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

            {/* Plan & Limits Tab */}
            <TabsContent value="plan" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Plan Tier</Label>
                <Select value={editForm.plan_tier || "free"} onValueChange={handlePlanChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_TIERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} — {p.memberLimit} members, {p.storageLimit}MB
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Member Limit</Label>
                <Input
                  type="number"
                  value={editForm.member_limit || ""}
                  onChange={(e) => setEditForm({ ...editForm, member_limit: e.target.value })}
                  min={1}
                />
                {editTenant && tenantStats[editTenant.id] && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Current usage</span>
                      <span>{tenantStats[editTenant.id].members}/{editForm.member_limit}</span>
                    </div>
                    <Progress
                      value={Math.min(Math.round((tenantStats[editTenant.id].members / (editForm.member_limit || 1)) * 100), 100)}
                      className="h-2"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Storage Limit (MB)</Label>
                <Input
                  type="number"
                  value={editForm.storage_limit_mb || ""}
                  onChange={(e) => setEditForm({ ...editForm, storage_limit_mb: e.target.value })}
                  min={100}
                />
              </div>

              <div className="space-y-2">
                <Label>Monthly SMS Limit <span className="text-muted-foreground font-normal">(0 = unlimited)</span></Label>
                <Input
                  type="number"
                  value={editForm.sms_limit_monthly || ""}
                  onChange={(e) => setEditForm({ ...editForm, sms_limit_monthly: e.target.value })}
                  min={0}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Monthly WhatsApp Limit <span className="text-muted-foreground font-normal">(0 = unlimited)</span></Label>
                <Input
                  type="number"
                  value={editForm.whatsapp_limit_monthly || ""}
                  onChange={(e) => setEditForm({ ...editForm, whatsapp_limit_monthly: e.target.value })}
                  min={0}
                  placeholder="0"
                />
              </div>

              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
                <p className="font-medium">Plan tier presets:</p>
                {PLAN_TIERS.map(p => (
                  <p key={p.value}>• <strong>{p.label}</strong>: {p.memberLimit} members, {p.storageLimit}MB, {p.smsLimit || "∞"} SMS, {p.whatsappLimit || "∞"} WhatsApp</p>
                ))}
              </div>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="space-y-4 mt-4">
              <TenantBillingTab tenant={editTenant} />
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

      {/* Tenant Users Dialog */}
      <TenantUsersDialog
        tenant={usersTenant}
        open={!!usersTenant}
        onOpenChange={(open) => !open && setUsersTenant(null)}
      />
    </div>
  );
}
