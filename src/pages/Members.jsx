import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Download, Upload, Mail, Phone, MoreVertical, Edit, Trash2, Loader2, QrCode, Link2, Unlink2, Award } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import MemberFormDialog from "@/components/members/MemberFormDialog";
import RegistrationQRCode from "@/components/members/RegistrationQRCode";
import BulkImportDialog from "@/components/members/BulkImportDialog";
import IssueCertificateDialog from "@/components/certificates/IssueCertificateDialog";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/useAuth";

const statusColors = {
  "Active": "bg-chart-3/10 text-chart-3",
  "Inactive": "bg-muted text-muted-foreground",
  "New Convert": "bg-accent/10 text-accent",
  "First Timer": "bg-chart-4/10 text-chart-4",
};

export default function Members() {
  const { isAdmin, isUnitLeader, isWSFLeader, user, loading: authLoading, myMember } = useAuth();
  const isLeader = isUnitLeader || isWSFLeader;
  const viewOnly = isLeader && !isAdmin;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [certMember, setCertMember] = useState(null);
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", user?.id, isAdmin, viewOnly, myMember?.id],
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await supabase
          .from("members")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      } else if (viewOnly) {
        // Unit leaders / WSF leaders see members via RLS (their unit/centre members)
        const { data, error } = await supabase
          .from("members")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", user?.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      }
    },
    enabled: !!user?.id && !authLoading,
    refetchOnWindowFocus: true,
    refetchInterval: isAdmin || viewOnly ? 5000 : false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (member) => {
      // Unlink from any WSF centre leadership before deleting
      await supabase.from("wsf_centres").update({ leader_id: null }).eq("leader_id", member.id);
      const { error } = await supabase.from("members").delete().eq("id", member.id);
      if (error) throw error;

      // If member had a linked auth account, delete that too
      if (member.user_id) {
        const { data, error: fnError } = await supabase.functions.invoke("admin-delete-user", {
          body: { user_id: member.user_id },
        });
        if (fnError) console.warn("Could not delete auth account:", fnError.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({ title: "Member deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = members.filter((m) => {
    const matchSearch = `${m.first_name} ${m.last_name} ${m.email || ""} ${m.phone || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.membership_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    setEditingMember(null);
    setDialogOpen(true);
  };

  const openEdit = (m) => {
    setEditingMember(m);
    setDialogOpen(true);
  };

  const handleDelete = (member) => {
    const hasAccount = !!member.user_id;
    const msg = hasAccount
      ? `Delete this member AND their login account? They will no longer be able to sign in.`
      : `Delete this member?`;
    if (window.confirm(msg)) {
      deleteMutation.mutate(member);
      logAudit("member_delete", "members", member.id, {
        member_name: `${member.first_name} ${member.last_name}`,
        auth_account_deleted: hasAccount,
      });
    }
  };

  const handleDownloadCSV = () => {
    const headers = ["First Name", "Last Name", "Email", "Phone", "Status", "Gender", "Church Unit", "Membership Date"];
    const rows = filtered.map(m => [m.first_name, m.last_name, m.email, m.phone, m.membership_status, m.gender, m.church_unit, m.membership_date]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "members.csv";
    a.click();
  };

  // Check if current member can edit (own profile or admin; leaders are view-only)
  const canEditMember = (m) => isAdmin || m.user_id === user?.id;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          {(isAdmin || viewOnly) && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="New Convert">New Convert</SelectItem>
                <SelectItem value="First Timer">First Timer</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="grid grid-cols-4 sm:flex sm:flex-wrap items-center gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setQrOpen(true)} className="gap-1.5">
                <QrCode className="h-4 w-4" /><span className="hidden sm:inline">QR Code</span>
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="gap-1.5">
                <Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
                <Upload className="h-4 w-4" /><span className="hidden sm:inline">Import CSV</span>
              </Button>
              <Button onClick={openNew} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" /> Register Member
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats row - admins and leaders */}
      {(isAdmin || viewOnly) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-foreground">{members.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-chart-3">{members.filter(m => m.membership_status === "Active").length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-accent">{members.filter(m => m.membership_status === "New Convert").length}</p><p className="text-xs text-muted-foreground">New Converts</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-chart-4">{members.filter(m => m.membership_status === "First Timer").length}</p><p className="text-xs text-muted-foreground">First Timers</p></CardContent></Card>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 sm:p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-3 sm:p-4 font-medium text-muted-foreground hidden sm:table-cell">Contact</th>
                  {(isAdmin || viewOnly) && <th className="text-left p-3 sm:p-4 font-medium text-muted-foreground hidden md:table-cell">Church Unit</th>}
                   <th className="text-left p-3 sm:p-4 font-medium text-muted-foreground">Status</th>
                   {isAdmin && <th className="text-center p-3 sm:p-4 font-medium text-muted-foreground hidden sm:table-cell">Account</th>}
                  <th className="text-right p-3 sm:p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs sm:text-sm shrink-0">
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 hidden sm:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {m.email && <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {m.email}</span>}
                        {m.phone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {m.phone}</span>}
                      </div>
                    </td>
                    {(isAdmin || viewOnly) && (
                      <td className="p-4 hidden md:table-cell">
                        {m.church_unit ? (
                          <div className="flex flex-wrap gap-1">
                            {m.church_unit.split(",").map(u => u.trim()).filter(Boolean).map(u => (
                              <Badge key={u} variant="secondary" className="text-xs">{u}</Badge>
                            ))}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                    )}
                    <td className="p-4">
                      <Badge className={`${statusColors[m.membership_status] || "bg-muted text-muted-foreground"} border-0`}>
                        {m.membership_status}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-center">
                        {m.user_id ? (
                          <span className="inline-flex items-center gap-1 text-xs text-chart-3" title="Linked to user account">
                            <Link2 className="h-3.5 w-3.5" /> Linked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-500" title="No linked user account">
                            <Unlink2 className="h-3.5 w-3.5" /> Unlinked
                          </span>
                        )}
                      </td>
                    )}
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditMember(m) && (
                            <DropdownMenuItem onClick={() => openEdit(m)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                          )}
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => setCertMember(m)}><Award className="h-4 w-4 mr-2" /> Issue Certificate</DropdownMenuItem>
                          )}
                          {isAdmin && (
                            <DropdownMenuItem onClick={() => handleDelete(m)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          )}
                          {!canEditMember(m) && !isAdmin && (
                            <DropdownMenuItem disabled className="text-muted-foreground">View only</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={isAdmin ? 6 : (viewOnly ? 5 : 4)} className="p-8 text-center text-muted-foreground">No members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Form Dialog */}
      <MemberFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={editingMember}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["members"] });
          setDialogOpen(false);
        }}
      />
      <RegistrationQRCode open={qrOpen} onOpenChange={setQrOpen} />
      <BulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={() => queryClient.invalidateQueries({ queryKey: ["members"] })}
      />
      <IssueCertificateDialog
        open={!!certMember}
        onOpenChange={(open) => !open && setCertMember(null)}
        member={certMember}
      />
    </div>
  );
}
