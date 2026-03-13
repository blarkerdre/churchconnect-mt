import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Shield, ShieldCheck, UserCog, User, Plus, Trash2, Globe, UsersRound } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import UnitLeaderAssignments from "@/components/users/UnitLeaderAssignments";
import BulkUnitAssignDialog from "@/components/users/BulkUnitAssignDialog";

const ROLES = ["super_admin", "admin", "unit_leader", "wsf_leader", "member"];

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

export default function UserManagement() {
  const { isAdmin, roles, user } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", password: "", full_name: "", role: "member" });
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole, oldRole, targetName }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;
      await logAudit("role_change", "user_roles", userId, {
        old_role: oldRole, new_role: newRole, target_name: targetName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "Role updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const addUserMutation = useMutation({
    mutationFn: async (formData) => {
      // Use edge function to create user (admin can't directly create via client SDK)
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: formData.email, password: formData.password, full_name: formData.full_name, role: formData.role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await logAudit("user_create", "profiles", null, { email: formData.email, full_name: formData.full_name, role: formData.role });
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
      await logAudit("user_delete", "profiles", userId, { target_name: targetName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "User deleted" });
    },
    onError: (err) => toast({ title: "Error deleting user", description: err.message, variant: "destructive" }),
  });

  const getUserRole = (userId) => {
    const role = allRoles.find(r => r.user_id === userId);
    return role?.role || "member";
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage user roles and permissions</p>
        </div>
        <Button onClick={() => { setAddForm({ email: "", password: "", full_name: "", role: "member" }); setAddDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                   <th className="text-left p-4 font-medium text-muted-foreground">User</th>
                   <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
                   <th className="text-left p-4 font-medium text-muted-foreground">Current Role</th>
                   <th className="text-left p-4 font-medium text-muted-foreground">Led Units</th>
                   <th className="text-left p-4 font-medium text-muted-foreground">Change Role</th>
                   <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                 </tr>
              </thead>
              <tbody>
                {profiles.map(p => {
                  const currentRole = getUserRole(p.user_id);
                  const RoleIcon = roleIcons[currentRole] || User;
                  const isCurrentUser = p.user_id === user?.id;
                  return (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                            {(p.full_name || p.email || "?")[0].toUpperCase()}
                          </div>
                          <p className="font-medium text-foreground">{p.full_name || "—"}</p>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{p.email || "—"}</td>
                      <td className="p-4">
                        <Badge className={`${roleColors[currentRole]} border-0 gap-1`}>
                          <RoleIcon className="h-3 w-3" />
                          {currentRole.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {currentRole === "unit_leader" ? (
                          <UnitLeaderAssignments userId={p.user_id} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        {(() => {
                          const isTargetAdmin = ["admin", "super_admin"].includes(currentRole);
                          const canChangeRole = isSuperAdmin && !isCurrentUser;
                          
                          if (!canChangeRole && !(!isTargetAdmin && isAdmin)) {
                            return <span className="text-sm text-muted-foreground italic">No permission</span>;
                          }
                          
                          const availableRoles = isSuperAdmin 
                            ? ROLES 
                            : ROLES.filter(r => !["super_admin", "admin"].includes(r));
                          
                          return (
                            <Select
                              value={currentRole}
                              onValueChange={(newRole) => {
                                if (newRole !== currentRole) {
                                  updateRoleMutation.mutate({ userId: p.user_id, newRole, oldRole: currentRole, targetName: p.full_name || p.email });
                                }
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRoles.map(r => (
                                  <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-right">
                        {!isCurrentUser && (
                          <Button variant="ghost" size="icon" onClick={() => {
                            if (window.confirm(`Delete user ${p.full_name || p.email}? This cannot be undone.`)) {
                              deleteUserMutation.mutate({ userId: p.user_id, targetName: p.full_name || p.email });
                            }
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
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
              <Label>Role</Label>
              <Select value={addForm.role} onValueChange={v => setAddForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(isSuperAdmin ? ROLES : ROLES.filter(r => !["super_admin", "admin"].includes(r))).map(r => (
                    <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addUserMutation.mutate(addForm)} disabled={addUserMutation.isPending || !addForm.email || !addForm.password} className="w-full bg-primary">
              {addUserMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
