import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, ShieldCheck, UserCog, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

const ROLES = ["super_admin", "admin", "unit_leader", "member"];

const roleIcons = {
  super_admin: ShieldCheck,
  admin: Shield,
  unit_leader: UserCog,
  member: User,
};

const roleColors = {
  super_admin: "bg-destructive/10 text-destructive",
  admin: "bg-primary/10 text-primary",
  unit_leader: "bg-accent/10 text-accent",
  member: "bg-muted text-muted-foreground",
};

export default function UserManagement() {
  const { isAdmin, roles, user } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");
  const queryClient = useQueryClient();

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
    mutationFn: async ({ userId, newRole }) => {
      // Delete existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);
      // Insert new role
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "Role updated" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
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
      <div>
        <h2 className="text-lg font-display font-bold text-foreground">User Management</h2>
        <p className="text-sm text-muted-foreground">Manage user roles and permissions</p>
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
                  <th className="text-left p-4 font-medium text-muted-foreground">Change Role</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => {
                  const currentRole = getUserRole(p.user_id);
                  const RoleIcon = roleIcons[currentRole] || User;
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
                        <Select
                          value={currentRole}
                          onValueChange={(newRole) => {
                            if (newRole !== currentRole) {
                              updateRoleMutation.mutate({ userId: p.user_id, newRole });
                            }
                          }}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map(r => (
                              <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
                {profiles.length === 0 && (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
