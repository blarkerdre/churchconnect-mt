import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Shield, ShieldCheck, UserCog, User, Plus, Trash2, Globe, UsersRound, Ban, CheckCircle2, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import UnitLeaderAssignments from "@/components/users/UnitLeaderAssignments";
import WSFLeaderAssignments from "@/components/users/WSFLeaderAssignments";
import BulkUnitAssignDialog from "@/components/users/BulkUnitAssignDialog";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import DangerConfirmDialog from "@/components/exams/DangerConfirmDialog";

const ROLES = ["super_admin", "admin", "unit_leader", "wsf_leader"];

const roleIcons = {
  super_admin: ShieldCheck,
  admin: Shield,
  unit_leader: UserCog,
  wsf_leader: Globe,
  member: User,
};

const roleColors = {
  super_admin: "bg-destructive/10 text-destructive",
  admin: "bg-primary/10 text-primary",
  unit_leader: "bg-accent/10 text-accent",
  wsf_leader: "bg-chart-3/10 text-chart-3",
  member: "bg-muted text-muted-foreground",
};

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  unit_leader: "Unit Leader",
  wsf_leader: "Home Cell Leader",
  member: "Member",
};

export default function UserManagement() {
  const { isAdmin, roles, user } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const queryClient = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", password: "", full_name: "", role: "member" });
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toggleTarget, setToggleTarget] = useState(null);
  const [roleChangeTarget, setRoleChangeTarget] = useState(null);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["all-profiles", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("profiles").select("*").order("created_at", { ascending: false }));
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["all-user-roles", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("user_roles").select("*"));
      if (error) throw error;
      return data;
    },
  });

  // Fetch banned users from backend so disabled state persists across refreshes
  const { data: bannedUserIds = [] } = useQuery({
    queryKey: ["banned-users"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("admin-list-banned-users");
        if (error) {
          console.warn("Failed to fetch banned users:", error.message);
          return [];
        }
        if (data?.error) {
          console.warn("Banned users API error:", data.error);
          return [];
        }
        return data.banned_user_ids || [];
      } catch (e) {
        console.warn("Banned users fetch exception:", e);
        return [];
      }
    },
    retry: false,
  });

  const disabledUsers = Object.fromEntries(bannedUserIds.map(id => [id, true]));

  const toggleRoleMutation = useMutation({
    mutationFn: async ({ userId, role, add, targetName }) => {
      if (add) {
        const { error } = await supabase.from("user_roles").insert(withTenant({ user_id: userId, role }));
        if (error) throw error;
        await logAudit("role_add", "user_roles", userId, { role, target_name: targetName }, tenantId);
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role).eq("tenant_id", tenantId);
        if (error) throw error;
        await logAudit("role_remove", "user_roles", userId, { role, target_name: targetName }, tenantId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "Role updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addUserMutation = useMutation({
    mutationFn: async (formData) => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: formData.email, password: formData.password, full_name: formData.full_name, role: formData.role, tenant_id: tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logAudit("user_create", "profiles", null, { email: formData.email, full_name: formData.full_name, role: formData.role }, tenantId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "User created" });
      setAddDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error creating user", description: err.message, variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId, targetName }) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logAudit("user_delete", "profiles", userId, { target_name: targetName }, tenantId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "User deleted" });
    },
    onError: (err) => toast({ title: "Error deleting user", description: err.message, variant: "destructive" }),
  });

  const toggleUserMutation = useMutation({
    mutationFn: async ({ userId, disabled, targetName }) => {
      const { data, error } = await supabase.functions.invoke("admin-toggle-user", {
        body: { user_id: userId, disabled },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logAudit(disabled ? "user_disable" : "user_enable", "profiles", userId, { target_name: targetName }, tenantId);
      return { userId, disabled };
    },
    onSuccess: ({ userId, disabled }) => {
      queryClient.invalidateQueries({ queryKey: ["banned-users"] });
      toast({ title: disabled ? "User account disabled" : "User account enabled" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const getUserRoles = (userId) => {
    return allRoles.filter(r => r.user_id === userId).map(r => r.role);
  };

  const filteredProfiles = profiles.filter(p => {
    const q = searchQuery.toLowerCase();
    if (q && !(p.full_name || "").toLowerCase().includes(q) && !(p.email || "").toLowerCase().includes(q)) return false;
    if (roleFilter !== "all") {
      const ur = getUserRoles(p.user_id);
      if (roleFilter === "member") { if (ur.length > 0) return false; }
      else if (!ur.includes(roleFilter)) return false;
    }
    if (statusFilter === "active" && disabledUsers[p.user_id]) return false;
    if (statusFilter === "disabled" && !disabledUsers[p.user_id]) return false;
    return true;
  });

  if (!isAdmin) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          You do not have permission to access this page.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage user roles and permissions</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setBulkAssignOpen(true)}>
            <UsersRound className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Bulk Unit Assign</span><span className="sm:hidden">Bulk</span>
          </Button>
          <Button size="sm" onClick={() => { setAddForm({ email: "", password: "", full_name: "", role: "member" }); setAddDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" /> Add User
          </Button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={roleFilter === "unit_leader" ? "default" : "outline"}
          size="sm"
          onClick={() => setRoleFilter(roleFilter === "unit_leader" ? "all" : "unit_leader")}
          className="gap-1.5"
        >
          <UserCog className="h-4 w-4" />
          Unit Leaders
          {(() => {
            const count = profiles.filter(p => getUserRoles(p.user_id).includes("unit_leader")).length;
            return count > 0 ? (
              <Badge className={`ml-1 px-1.5 py-0 text-[10px] ${roleFilter === "unit_leader" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"} border-0`}>
                {count}
              </Badge>
            ) : null;
          })()}
        </Button>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map(r => <SelectItem key={r} value={r}>{roleLabels[r] || r.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Showing {filteredProfiles.length} of {profiles.length}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                 <tr className="border-b border-border bg-muted/50">
                   <th className="text-left p-3 sm:p-4 font-medium text-muted-foreground">User</th>
                   <th className="text-left p-3 sm:p-4 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                   <th className="text-left p-3 sm:p-4 font-medium text-muted-foreground">Roles</th>
                   <th className={`text-left p-3 sm:p-4 font-medium text-muted-foreground ${(roleFilter === "unit_leader" || roleFilter === "wsf_leader") ? "" : "hidden lg:table-cell"}`}>Assignments</th>
                   <th className="text-left p-3 sm:p-4 font-medium text-muted-foreground hidden md:table-cell">Manage Roles</th>
                   <th className="text-right p-3 sm:p-4 font-medium text-muted-foreground">Actions</th>
                 </tr>
              </thead>
              <tbody>
                {filteredProfiles.map(p => {
                  const userRoles = getUserRoles(p.user_id);
                  const isCurrentUser = p.user_id === user?.id;
                  const hasAdminRole = userRoles.some(r => ["admin", "super_admin"].includes(r));
                  const canChange = isCurrentUser ? false : (isSuperAdmin || (!hasAdminRole && isAdmin));
                  const isDisabled = disabledUsers[p.user_id] === true;
                  const targetIsSuperAdmin = userRoles.includes("super_admin");

                  const availableRoles = isSuperAdmin
                    ? ROLES
                    : ROLES.filter(r => !["super_admin", "admin"].includes(r));

                  return (
                    <tr key={p.id} className={`border-b border-border hover:bg-muted/30 transition-colors ${isDisabled ? "opacity-60" : ""}`}>
                      <td className="p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isDisabled ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                            {(p.full_name || p.email || "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{p.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground truncate md:hidden">{p.email || ""}</p>
                            {isDisabled && (
                              <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px] mt-0.5">
                                <Ban className="h-2.5 w-2.5 mr-1" /> Disabled
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 sm:p-4 text-muted-foreground hidden md:table-cell">{p.email || "—"}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.length === 0 ? (
                            <Badge className="bg-muted text-muted-foreground border-0 gap-1">
                              <User className="h-3 w-3" /> member
                            </Badge>
                          ) : userRoles.map(r => {
                            const RoleIcon = roleIcons[r] || User;
                            return (
                              <Badge key={r} className={`${roleColors[r]} border-0 gap-1`}>
                                <RoleIcon className="h-3 w-3" />
                                {roleLabels[r] || r.replace("_", " ")}
                              </Badge>
                            );
                          })}
                        </div>
                      </td>
                      <td className={`p-3 sm:p-4 ${(roleFilter === "unit_leader" || roleFilter === "wsf_leader") ? "" : "hidden lg:table-cell"}`}>
                        <div className="space-y-1.5">
                          {userRoles.includes("unit_leader") && (
                            <UnitLeaderAssignments userId={p.user_id} />
                          )}
                          {userRoles.includes("wsf_leader") && (
                            <WSFLeaderAssignments userId={p.user_id} />
                          )}
                          {!userRoles.includes("unit_leader") && !userRoles.includes("wsf_leader") && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 sm:p-4 hidden md:table-cell">
                        {canChange ? (
                          <div className="space-y-1.5">
                            {availableRoles.map(r => {
                              const hasRole = userRoles.includes(r);
                              return (
                                <label key={r} className="flex items-center gap-2 cursor-pointer text-sm">
                                  <Checkbox
                                    checked={hasRole}
                                    onCheckedChange={(checked) => {
                                      setRoleChangeTarget({
                                        userId: p.user_id,
                                        role: r,
                                        add: !!checked,
                                        targetName: p.full_name || p.email,
                                      });
                                    }}
                                    disabled={toggleRoleMutation.isPending}
                                  />
                                  <span className="capitalize">{roleLabels[r] || r.replace("_", " ")}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            {isCurrentUser ? "Can't change own" : "No permission"}
                          </span>
                        )}
                      </td>
                      <td className="p-3 sm:p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Disable/Enable - available to admin & super_admin */}
                          {!isCurrentUser && !(targetIsSuperAdmin && !isSuperAdmin) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={isDisabled ? "Enable account" : "Disable account"}
                              disabled={toggleUserMutation.isPending}
                              onClick={() => {
                                setToggleTarget({
                                  userId: p.user_id,
                                  disabled: !isDisabled,
                                  targetName: p.full_name || p.email,
                                  isCurrentlyDisabled: isDisabled,
                                });
                              }}
                            >
                              {isDisabled ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : (
                                <Ban className="h-4 w-4 text-amber-500" />
                              )}
                            </Button>
                          )}
                          {/* Delete - super_admin only */}
                          {isSuperAdmin && !isCurrentUser && (
                            <Button variant="ghost" size="icon" onClick={() => {
                              setDeleteTarget({ userId: p.user_id, targetName: p.full_name || p.email });
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {profiles.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Full Name</Label><Input value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Password</Label><Input type="password" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div>
              <Label>Initial Role</Label>
              <Select value={addForm.role} onValueChange={v => setAddForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(isSuperAdmin ? ROLES : ROLES.filter(r => !["super_admin", "admin"].includes(r))).map(r => (
                    <SelectItem key={r} value={r}>{roleLabels[r] || r.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">You can add more roles after creation</p>
            </div>
            <Button onClick={() => addUserMutation.mutate(addForm)} disabled={addUserMutation.isPending || !addForm.email || !addForm.password} className="w-full bg-primary">
              {addUserMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create User
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <BulkUnitAssignDialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen} />

      {/* Delete user confirmation */}
      <DangerConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete User Account"
        entityName={deleteTarget?.targetName || ""}
        confirmLabel="Delete User"
        impacts={[
          "The user's auth account, profile, role assignments and tenant memberships will be permanently removed.",
          "Linked member records remain but will become unlinked.",
          "This action cannot be undone.",
        ]}
        isPending={deleteUserMutation.isPending}
        onConfirm={async () => {
          await new Promise((resolve, reject) => {
            deleteUserMutation.mutate(deleteTarget, {
              onSuccess: () => resolve(),
              onError: (err) => reject(err),
            });
          });
          setDeleteTarget(null);
        }}
      />

      {/* Disable/Enable user confirmation */}
      <DangerConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={toggleTarget?.isCurrentlyDisabled ? "Enable User Account" : "Disable User Account"}
        entityName={toggleTarget?.targetName || ""}
        confirmText="CONFIRM"
        confirmLabel={toggleTarget?.isCurrentlyDisabled ? "Enable Account" : "Disable Account"}
        impacts={
          toggleTarget?.isCurrentlyDisabled
            ? ["The user will regain access and be able to sign in immediately."]
            : [
                "The user will be immediately signed out and unable to log in.",
                "Their data and role assignments are retained — they can be re-enabled later.",
              ]
        }
        isPending={toggleUserMutation.isPending}
        onConfirm={async () => {
          await new Promise((resolve, reject) => {
            toggleUserMutation.mutate(
              {
                userId: toggleTarget.userId,
                disabled: toggleTarget.disabled,
                targetName: toggleTarget.targetName,
              },
              { onSuccess: () => resolve(), onError: (err) => reject(err) }
            );
          });
          setToggleTarget(null);
        }}
      />

      {/* Role change confirmation */}
      <DangerConfirmDialog
        open={!!roleChangeTarget}
        onOpenChange={(open) => !open && setRoleChangeTarget(null)}
        title={roleChangeTarget?.add ? "Grant Role" : "Revoke Role"}
        entityName={roleChangeTarget?.targetName || ""}
        confirmText="CONFIRM"
        confirmLabel={roleChangeTarget?.add ? "Grant Role" : "Revoke Role"}
        impacts={[
          roleChangeTarget?.add
            ? `This user will be granted the "${roleLabels[roleChangeTarget?.role] || roleChangeTarget?.role}" role and gain associated privileges.`
            : `This user will lose the "${roleLabels[roleChangeTarget?.role] || roleChangeTarget?.role}" role and its associated access immediately.`,
          "This privilege change will be recorded in the audit log.",
        ]}
        isPending={toggleRoleMutation.isPending}
        onConfirm={async () => {
          await new Promise((resolve, reject) => {
            toggleRoleMutation.mutate(roleChangeTarget, {
              onSuccess: () => resolve(),
              onError: (err) => reject(err),
            });
          });
          setRoleChangeTarget(null);
        }}
      />
    </div>
  );
}
