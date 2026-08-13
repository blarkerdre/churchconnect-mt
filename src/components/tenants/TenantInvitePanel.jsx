import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Clock, CheckCircle2, XCircle, RefreshCw, Copy, MailCheck, MailWarning } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";

/**
 * Invite form + invitation list for a single tenant (church).
 *
 * Used both by the super-admin Tenant Admin dialog and by the church-level
 * User Management page. All reads/writes are scoped with an explicit
 * tenant_id guard; the invite-to-tenant edge function re-checks that the
 * caller administers the tenant and blocks owner/admin escalation.
 */
export default function TenantInvitePanel({ tenantId, pendingOnly = false }) {
  const { toast } = useToast();
  const confirmDelete = useConfirmDelete();
  const queryClient = useQueryClient();
  const { roles: userRoles, tenantMemberships } = useAuth();

  const isSuperAdmin = (userRoles || []).includes("super_admin");
  const isOwnerOfThisTenant = (tenantMemberships || []).some(
    (m) => m.tenant_id === tenantId && m.role === "owner"
  );
  const canPromoteToAdmin = isSuperAdmin || isOwnerOfThisTenant;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const { data: invitations = [], isLoading, isError, error } = useQuery({
    queryKey: ["tenant-invitations", tenantId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("tenant_invitations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (err) throw err;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Delivery status for invitation emails in this church, latest row per recipient.
  const { data: deliveryByEmail = {} } = useQuery({
    queryKey: ["tenant-invitation-emails", tenantId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("email_send_log")
        .select("recipient_email, status, error_message, created_at")
        .eq("tenant_id", tenantId)
        .eq("template_name", "tenant-invitation")
        .order("created_at", { ascending: false })
        .limit(500);
      if (err) throw err;
      const latest = {};
      for (const row of data || []) {
        const key = (row.recipient_email || "").toLowerCase();
        if (!latest[key]) latest[key] = row;
      }
      return latest;
    },
    enabled: !!tenantId,
  });


  const sendInvite = useMutation({
    mutationFn: async ({ email: to, role: asRole }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-to-tenant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ tenant_id: tenantId, email: to, role: asRole }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Invitation failed");
      return result;
    },
    onSuccess: (result, variables) => {
      const okTitle = result.already_member
        ? "This person already belongs to this church"
        : result.reused_pending_invitation
        ? "Invitation resent"
        : result.auto_added
        ? "User added to this church"
        : "Invitation sent";
      toast({
        title: result.email_warning ? "Invitation saved — email NOT sent" : okTitle,
        description: result.email_warning
          ? `${result.email_warning} Use "Copy invite link" to share it directly.`
          : undefined,
        variant: result.email_warning ? "destructive" : undefined,
      });
      if (!variables?.isResend) {
        setEmail("");
        setRole("member");
      }
      queryClient.invalidateQueries({ queryKey: ["tenant-invitations", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-invitation-emails", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-users", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-stats"] });
    },

    onError: (err) =>
      toast({ title: "Error sending invitation", description: err.message, variant: "destructive" }),
  });

  const cancelInvite = useMutation({
    mutationFn: async (invitationId) => {
      const { error: err } = await supabase
        .from("tenant_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId)
        .eq("tenant_id", tenantId);
      if (err) throw err;
    },
    onSuccess: () => {
      toast({ title: "Invitation cancelled" });
      queryClient.invalidateQueries({ queryKey: ["tenant-invitations", tenantId] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    sendInvite.mutate({ email: email.trim(), role });
  };

  const handleCancel = async (inv) => {
    const ok = await confirmDelete({
      title: "Cancel invitation",
      description: `Cancel the pending invitation for ${inv.email}? They will no longer be able to join with this invite.`,
      confirmLabel: "Cancel invite",
    });
    if (ok) cancelInvite.mutate(inv.id);
  };

  const rows = pendingOnly ? invitations.filter((i) => i.status === "pending") : invitations;

  if (!tenantId) return null;

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/50 rounded-lg">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address to invite"
          type="email"
          required
          className="flex-1"
        />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            {canPromoteToAdmin && <SelectItem value="admin">Admin</SelectItem>}
            {canPromoteToAdmin && <SelectItem value="owner">Owner</SelectItem>}
          </SelectContent>
        </Select>
        <Button type="submit" size="sm" disabled={sendInvite.isPending}>
          <Mail className="h-4 w-4 mr-1" />
          {sendInvite.isPending ? "Sending..." : "Send invite"}
        </Button>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">Loading invitations...</p>
      ) : isError ? (
        <p className="text-sm text-destructive py-4">
          Failed to load invitations: {error?.message || "Unknown error"}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {pendingOnly ? "No pending invitations." : "No invitations sent yet."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <p className="text-sm break-all">{inv.email}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Sent {new Date(inv.created_at).toLocaleDateString()}
                      {inv.expires_at && ` · expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">{inv.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {inv.status === "pending" ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">Pending</Badge>
                    ) : inv.status === "accepted" ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />Accepted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs capitalize">
                        <XCircle className="h-3 w-3 mr-1" />{inv.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {inv.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={sendInvite.isPending}
                          onClick={() => sendInvite.mutate({ email: inv.email, role: inv.role, isResend: true })}
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />Resend
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleCancel(inv)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
