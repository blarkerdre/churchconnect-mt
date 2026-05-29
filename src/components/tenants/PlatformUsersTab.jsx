import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { Shield, ShieldOff, Search, Crown } from "lucide-react";

export default function PlatformUsersTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [superOnly, setSuperOnly] = useState(false);
  const [confirm, setConfirm] = useState(null); // { action: 'grant'|'revoke', user }

  const { data, isLoading } = useQuery({
    queryKey: ["platform-users"],
    queryFn: async () => {
      const [profilesRes, rolesRes, tmRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email, avatar_url").order("full_name"),
        supabase.from("user_roles").select("user_id, role, tenant_id").eq("role", "super_admin").is("tenant_id", null),
        supabase.from("tenant_memberships").select("user_id, role, tenants(name, slug)"),
      ]);
      if (profilesRes.error) throw profilesRes.error;

      // Deduplicate by user_id (profiles may have multiple rows per user across tenants)
      const byUser = new Map();
      for (const p of profilesRes.data || []) {
        if (!byUser.has(p.user_id)) byUser.set(p.user_id, p);
      }
      const superSet = new Set((rolesRes.data || []).map((r) => r.user_id));
      const tmByUser = new Map();
      for (const m of tmRes.data || []) {
        if (!tmByUser.has(m.user_id)) tmByUser.set(m.user_id, []);
        tmByUser.get(m.user_id).push(m);
      }

      return Array.from(byUser.values()).map((p) => ({
        ...p,
        isSuperAdmin: superSet.has(p.user_id),
        memberships: tmByUser.get(p.user_id) || [],
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = data || [];
    if (superOnly) rows = rows.filter((r) => r.isSuperAdmin);
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.full_name || "").toLowerCase().includes(q) ||
          (r.email || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, search, superOnly]);

  const grantMutation = useMutation({
    mutationFn: async (targetUser) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: targetUser.user_id, role: "super_admin", tenant_id: null });
      if (error) throw error;
      await logAudit("super_admin_grant", "user_roles", targetUser.user_id, {
        target_email: targetUser.email,
        target_name: targetUser.full_name,
      });
    },
    onSuccess: (_d, targetUser) => {
      toast({ title: "Super Admin granted", description: `${targetUser.email} now has platform-wide access.` });
      qc.invalidateQueries({ queryKey: ["platform-users"] });
      setConfirm(null);
    },
    onError: (e) => toast({ title: "Failed to grant", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (targetUser) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", targetUser.user_id)
        .eq("role", "super_admin")
        .is("tenant_id", null);
      if (error) throw error;
      await logAudit("super_admin_revoke", "user_roles", targetUser.user_id, {
        target_email: targetUser.email,
        target_name: targetUser.full_name,
      });
    },
    onSuccess: (_d, targetUser) => {
      toast({ title: "Super Admin revoked", description: `${targetUser.email} no longer has platform-wide access.` });
      qc.invalidateQueries({ queryKey: ["platform-users"] });
      setConfirm(null);
    },
    onError: (e) => toast({ title: "Failed to revoke", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-amber-500" />
          Platform Users
        </CardTitle>
        <CardDescription>
          Every user across all tenants. Grant or revoke platform-wide Super Admin access here.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            size="sm"
            variant={superOnly ? "default" : "outline"}
            onClick={() => setSuperOnly((v) => !v)}
          >
            <Crown className="h-3.5 w-3.5 mr-1" />
            Super Admins only
          </Button>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tenants</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No users found.</TableCell></TableRow>
              )}
              {filtered.map((u) => {
                const isSelf = u.user_id === user?.id;
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.memberships.length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                        {u.memberships.map((m, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {m.tenants?.name || m.tenants?.slug || "?"} · {m.role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.isSuperAdmin ? (
                        <Badge className="bg-amber-500 hover:bg-amber-500/90 text-white">
                          <Crown className="h-3 w-3 mr-1" /> Super Admin
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {u.isSuperAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSelf}
                          title={isSelf ? "You can't revoke your own Super Admin role" : ""}
                          onClick={() => setConfirm({ action: "revoke", user: u })}
                        >
                          <ShieldOff className="h-3.5 w-3.5 mr-1" />
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setConfirm({ action: "grant", user: u })}
                        >
                          <Shield className="h-3.5 w-3.5 mr-1" />
                          Promote
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "grant" ? "Promote to Super Admin?" : "Revoke Super Admin?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "grant" ? (
                <>This grants <strong>{confirm?.user?.email}</strong> platform-wide access to every tenant, including billing, archival, and all member data. Proceed only if you fully trust this person.</>
              ) : (
                <>This removes platform-wide Super Admin access from <strong>{confirm?.user?.email}</strong>. Their tenant memberships are unchanged.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!confirm) return;
                if (confirm.action === "grant") grantMutation.mutate(confirm.user);
                else revokeMutation.mutate(confirm.user);
              }}
              disabled={grantMutation.isPending || revokeMutation.isPending}
            >
              {confirm?.action === "grant" ? "Yes, promote" : "Yes, revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
