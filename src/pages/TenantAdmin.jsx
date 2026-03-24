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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, UserCheck, Plus, CheckCircle2, ArrowRightLeft, Globe, Clock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function TenantAdmin() {
  const { user } = useAuth();
  const { tenantId, switchTenant, tenantMemberships } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: "", slug: "", timezone: "Europe/London" });

  // Fetch all tenants (super admin sees all via service role — but we use RLS, so need a policy or just show memberships)
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch member counts per tenant
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
      // Add creator as owner
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

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newTenant.name || !newTenant.slug) return;
    createMutation.mutate(newTenant);
  };

  const handleSwitch = (tid) => {
    switchTenant(tid);
    toast({ title: "Switched tenant context" });
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
                            {t.name}
                            {isActive && <Badge variant="secondary" className="text-[10px]">Active</Badge>}
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
                          {isMember && !isActive && (
                            <Button size="sm" variant="outline" onClick={() => handleSwitch(t.id)}>
                              <ArrowRightLeft className="h-3 w-3 mr-1" /> Switch
                            </Button>
                          )}
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
    </div>
  );
}
