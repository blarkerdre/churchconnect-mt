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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Trash2, Shield, Crown, User, Mail, Clock, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ROLE_CONFIG = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-600 bg-amber-50 border-amber-200" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-600 bg-blue-50 border-blue-200" },
  member: { label: "Member", icon: User, color: "text-muted-foreground bg-muted border-border" },
};

export default function TenantUsersDialog({ tenant, open, onOpenChange }) {
  const { toast } = useToast();
  const { user, roles: userRoles } = useAuth();
  const isSuperAdmin = userRoles.includes("super_admin");
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

  const { data: invitations = [] } = useQuery({
    queryKey: ["tenant-invitations", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_invitations")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id && open,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-to-tenant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ tenant_id: tenant.id, email, role }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: (result) => {
      toast({ title: result.auto_added ? "User added to tenant" : "Invitation sent" });
      setAddEmail("");
      setAddRole("member");
      queryClient.invalidateQueries({ queryKey: ["tenant-users", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["tenant-invitations", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["tenant-stats"] });
    },
    onError: (err) => {
      toast({ title: "Error inviting user", description: err.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ membershipId, role }) => {
      const { error } = await supabase
        .from("tenant_memberships")
        .update({ role })
        .eq("id", membershipId)
        .eq("tenant_id", tenant.id);
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
        .eq("id", membershipId)
        .eq("tenant_id", tenant.id);
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

  const cancelInviteMutation = useMutation({
    mutationFn: async (invitationId) => {
      const { error } = await supabase
        .from("tenant_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId)
        .eq("tenant_id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      queryClient.invalidateQueries({ queryKey: ["tenant-invitations", tenant?.id] });
    },
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    inviteMutation.mutate({ email: addEmail, role: addRole });
  };

  const ownerCount = memberships.filter(m => m.role === "owner").length;
  const pendingInvitations = invitations.filter(i => i.status === "pending");

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Users — {tenant.name}
            {isSuperAdmin && (
              <Badge variant="outline" className="text-xs text-violet-600 border-violet-200 bg-violet-50 ml-2">
                <ShieldCheck className="h-3 w-3 mr-1" />Super Admin Mode
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Invite User Form */}
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <Input
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Email address to invite"
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
          <Button type="submit" size="sm" disabled={inviteMutation.isPending}>
            <Mail className="h-4 w-4 mr-1" />
            {inviteMutation.isPending ? "Sending..." : "Invite"}
          </Button>
        </form>

        <Tabs defaultValue="users">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="users">Users ({memberships.length})</TabsTrigger>
            <TabsTrigger value="invitations">
              Invitations {pendingInvitations.length > 0 && `(${pendingInvitations.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
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
          </TabsContent>

          <TabsContent value="invitations">
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No invitations sent yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <p className="text-sm">{inv.email}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(inv.created_at).toLocaleDateString()}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{inv.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {inv.status === "pending" ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">Pending</Badge>
                          ) : inv.status === "accepted" ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Accepted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-xs">
                              <XCircle className="h-3 w-3 mr-1" />{inv.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {inv.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => cancelInviteMutation.mutate(inv.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          {memberships.length} user{memberships.length !== 1 ? "s" : ""} in this tenant
        </p>
      </DialogContent>
    </Dialog>
  );
}
