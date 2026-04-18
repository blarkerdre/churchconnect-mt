import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Trash2, Shield, Crown, User, Mail, Clock, CheckCircle2, XCircle, ShieldCheck, Search, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const ROLE_CONFIG = {
  owner: { label: "Owner", icon: Crown, color: "text-amber-600 bg-amber-50 border-amber-200" },
  admin: { label: "Admin", icon: Shield, color: "text-blue-600 bg-blue-50 border-blue-200" },
  member: { label: "Member", icon: User, color: "text-muted-foreground bg-muted border-border" },
};

const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member" };

function describeAction(action) {
  if (!action) return { title: "", description: "", severity: "amber" };
  const name = action.membership?.profiles?.full_name || action.membership?.profiles?.email || "this user";
  if (action.type === "remove") {
    return {
      title: `Remove ${name} from this church?`,
      description: "They will immediately lose all access to this church's data and dashboards.",
      severity: "destructive",
    };
  }
  if (action.type === "role") {
    const from = ROLE_LABEL[action.membership.role];
    const to = ROLE_LABEL[action.newRole];
    if (action.newRole === "owner") {
      return {
        title: `Promote ${name} to Owner?`,
        description: `This grants ${name} full control of the church, including the ability to manage other owners.`,
        severity: "destructive",
      };
    }
    if (action.membership.role === "owner") {
      return {
        title: `Demote ${name} from Owner to ${to}?`,
        description: `${name} will lose church-wide control. Make sure at least one other owner remains.`,
        severity: "amber",
      };
    }
    return {
      title: `Change ${name}'s role from ${from} to ${to}?`,
      description: `This will adjust ${name}'s permissions in this church immediately.`,
      severity: "amber",
    };
  }
  return { title: "Confirm action", description: "", severity: "amber" };
}

export default function TenantUsersDialog({ tenant, open, onOpenChange }) {
  const { toast } = useToast();
  const { user, roles: userRoles } = useAuth();
  const isSuperAdmin = userRoles.includes("super_admin");
  const queryClient = useQueryClient();
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("member");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmToken, setConfirmToken] = useState("");
  const [selectVersion, setSelectVersion] = useState(0);

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ["tenant-users", tenant?.id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("tenant_memberships")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!rows?.length) return [];
      const userIds = rows.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      const byId = Object.fromEntries((profiles || []).map((p) => [p.user_id, p]));
      return rows.map((r) => ({ ...r, profiles: byId[r.user_id] || null }));
    },
    enabled: !!tenant?.id && open,
  });

  const { data: invitations = [], isLoading: invLoading, isError: invError, error: invQueryError } = useQuery({
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
      const title = result.already_member
        ? "User already belongs to this tenant"
        : result.reused_pending_invitation
        ? "Invitation resent"
        : result.auto_added
        ? "User added to tenant"
        : "Invitation sent";
      toast({
        title,
        description: result.email_warning || undefined,
        variant: result.email_warning ? "destructive" : undefined,
      });
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

  const requestAction = (action) => {
    setConfirmToken("");
    setPendingAction(action);
  };

  const closeConfirm = () => {
    setPendingAction(null);
    setConfirmToken("");
    // Force the role Select components to re-mount so they snap back to the actual DB role
    setSelectVersion((v) => v + 1);
  };

  const getRequiredToken = (action) => {
    if (!action) return null;
    if (action.type === "remove") return "REMOVE";
    if (action.type === "role") {
      if (action.newRole === "owner") return "PROMOTE";
      if (action.membership.role === "owner") return "DEMOTE";
    }
    return null;
  };

  const requiredToken = getRequiredToken(pendingAction);

  const handleConfirm = () => {
    if (!pendingAction) return;
    if (requiredToken && confirmToken.trim().toUpperCase() !== requiredToken) {
      toast({
        title: `Type ${requiredToken} to confirm`,
        description: "The confirmation text does not match.",
        variant: "destructive",
      });
      return;
    }
    if (pendingAction.type === "remove") {
      removeMutation.mutate(pendingAction.membership.id);
    } else if (pendingAction.type === "role") {
      updateRoleMutation.mutate({ membershipId: pendingAction.membership.id, role: pendingAction.newRole });
    }
    closeConfirm();
  };

  const ownerCount = memberships.filter(m => m.role === "owner").length;
  const pendingInvitations = invitations.filter(i => i.status === "pending");

  const filteredMemberships = memberships.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.profiles?.full_name || "").toLowerCase().includes(q) ||
      (m.profiles?.email || "").toLowerCase().includes(q) ||
      (m.role || "").toLowerCase().includes(q)
    );
  });

  const actionMeta = describeAction(pendingAction);

  if (!tenant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <TooltipProvider>
        <TenantDialogHeader>
            Users — {tenant.name}
            {isSuperAdmin && (
              <Badge variant="outline" className="text-xs text-violet-600 border-violet-200 bg-violet-50 ml-2">
                <ShieldCheck className="h-3 w-3 mr-1" />Super Admin Mode
              </Badge>
            )}
          </TenantDialogHeader>

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
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name, email, or role..."
                className="pl-8"
              />
            </div>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading users...</p>
            ) : memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No users in this tenant yet.</p>
            ) : filteredMemberships.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No users match "{search}".</p>
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
                    {filteredMemberships.map((m) => {
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
                              key={`${m.id}-${m.role}-${selectVersion}`}
                              value={m.role}
                              onValueChange={(newRole) => {
                                if (newRole === m.role) return;
                                requestAction({ type: "role", membership: m, newRole });
                              }}
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
                          <TableCell className="text-right space-x-1">
                            {isSuperAdmin && m.role !== "owner" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => requestAction({ type: "role", membership: m, newRole: "owner" })}
                                  >
                                    <Crown className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Promote to Owner</TooltipContent>
                              </Tooltip>
                            )}
                            {isSuperAdmin && m.role === "member" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    onClick={() => requestAction({ type: "role", membership: m, newRole: "admin" })}
                                  >
                                    <Shield className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Promote to Admin</TooltipContent>
                              </Tooltip>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={isOnlyOwner || (isSuperAdmin && m.profiles?.user_id === user?.id) || removeMutation.isPending}
                              onClick={() => requestAction({ type: "remove", membership: m })}
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
            {invLoading ? (
              <p className="text-sm text-muted-foreground py-4">Loading invitations...</p>
            ) : invError ? (
              <p className="text-sm text-destructive py-4">Failed to load invitations: {invQueryError?.message || "Unknown error"}</p>
            ) : invitations.length === 0 ? (
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
        </TooltipProvider>

        <AlertDialog open={!!pendingAction} onOpenChange={(o) => { if (!o) closeConfirm(); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className={actionMeta.severity === "destructive" ? "h-5 w-5 text-destructive" : "h-5 w-5 text-amber-600"} />
                {actionMeta.title}
              </AlertDialogTitle>
              <AlertDialogDescription>{actionMeta.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sm">
                Enter your password to confirm
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="current-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Your account password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Signed in as {user?.email}
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={verifying}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleConfirm(); }}
                disabled={verifying || !confirmPassword}
                className={actionMeta.severity === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              >
                {verifying ? "Verifying..." : "Confirm"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
