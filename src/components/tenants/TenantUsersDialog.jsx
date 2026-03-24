import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Trash2, Shield, Crown, User } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ROLE_CONFIG = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-600 bg-amber-50 border-amber-200" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-600 bg-blue-50 border-blue-200" },
  member: { label: "Member", icon: User, color: "text-muted-foreground bg-muted border-border" },
};

export default function TenantUsersDialog({ tenant, open, onOpenChange }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("member");

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["tenant-users", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_memberships")
        .select("*, profiles!inner(user_id, full_name, email)")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && open,
  });

  const addMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      // Find user by email in profiles
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();
      if (profileErr) throw profileErr;
      if (!profile) throw new Error("No user found with that email address");

      // Check if already a member
      const { data: existing } = await supabase
        .from("tenant_memberships")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("user_id", profile.user_id)
        .maybeSingle();
      if (existing) throw new Error("User is already a member of this tenant");

      const { error } = await supabase.from("tenant_memberships").insert({
        tenant_id: tenant.id,
        user_id: profile.user_id,
        role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "User added to tenant" });
      setAddEmail("");
      setAddRole("member");
      queryClient.invalidateQueries({ queryKey: ["tenant-users", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (err) => {
      toast({ title: "Error adding user", description: err.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ membershipId, role }) => {
      const { error } = await supabase
        .from("tenant_memberships")
        .update({ role })
        .eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: ["tenant-users", tenant?.id] });
    },
    onError: (err) => {
      toast({ title: "Error updating role", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (membershipId) => {
      const { error } = await supabase
        .from("tenant_memberships")
        .delete()
        .eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "User removed from tenant" });
      queryClient.invalidateQueries({ queryKey: ["tenant-users", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (err) => {
      toast({ title: "Error removing user", description: err.message, variant: "destructive" });
    },
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    addMutation.mutate({ email: addEmail, role: addRole });
  };

  const ownerCount = memberships.filter(m => m.role === "owner").length;

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Users — {tenant.name}</DialogTitle>
        </DialogHeader>

        {/* Add User Form */}
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <Input
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="User email address"
              type="email"
              required
            />
          </div>
          <Select value={addRole} onValueChange={setAddRole}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" disabled={addMutation.isPending}>
            <UserPlus className="h-4 w-4 mr-1" />
            {addMutation.isPending ? "Adding..." : "Add"}
          </Button>
        </form>

        {/* Users Table */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Loading users...</p>
        ) : memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No users in this tenant yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((m) => {
                  const profile = m.profiles;
                  const roleConf = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
                  const isOnlyOwner = m.role === "owner" && ownerCount <= 1;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{profile?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{profile?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={m.role}
                          onValueChange={(newRole) => updateRoleMutation.mutate({ membershipId: m.id, role: newRole })}
                        >
                          <SelectTrigger className="w-28 h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={isOnlyOwner || removeMutation.isPending}
                          onClick={() => removeMutation.mutate(m.id)}
                          title={isOnlyOwner ? "Cannot remove the only owner" : "Remove from tenant"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {memberships.length} user{memberships.length !== 1 ? "s" : ""} in this tenant
        </p>
      </DialogContent>
    </Dialog>
  );
}
