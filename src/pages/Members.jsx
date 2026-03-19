import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Download, Mail, Phone, MoreVertical, Edit, Trash2, Loader2, QrCode } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import MemberFormDialog from "@/components/members/MemberFormDialog";
import RegistrationQRCode from "@/components/members/RegistrationQRCode";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/useAuth";

const statusColors = {
  "Active": "bg-chart-3/10 text-chart-3",
  "Inactive": "bg-muted text-muted-foreground",
  "New Convert": "bg-accent/10 text-accent",
  "First Timer": "bg-chart-4/10 text-chart-4",
};

export default function Members() {
  const { isAdmin, isUnitLeader, isWSFLeader, leaderUnits, user } = useAuth();
  const isLeader = isUnitLeader || isWSFLeader;
  const viewOnly = isLeader && !isAdmin;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", isAdmin, viewOnly],
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
    enabled: !!user?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("members").delete().eq("id", id);
      if (error) throw error;
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
    if (window.confirm("Delete this member?")) {
      deleteMutation.mutate(member.id);
      logAudit("member_delete", "members", member.id, {
        member_name: `${member.first_name} ${member.last_name}`,
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
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setQrOpen(true)} className="gap-1.5">
                <QrCode className="h-4 w-4" /> QR Code
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="gap-1.5">
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button onClick={openNew} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" /> Register Member
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats row - admins and leaders */}
      {(isAdmin || viewOnly) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{members.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{members.filter(m => m.membership_status === "Active").length}</p><p className="text-xs text-muted-foreground">Active</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{members.filter(m => m.membership_status === "New Convert").length}</p><p className="text-xs text-muted-foreground">New Converts</p></CardContent></Card>
          <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-4">{members.filter(m => m.membership_status === "First Timer").length}</p><p className="text-xs text-muted-foreground">First Timers</p></CardContent></Card>
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
                  <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                  <th className="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell">Contact</th>
                  {(isAdmin || viewOnly) && <th className="text-left p-4 font-medium text-muted-foreground hidden md:table-cell">Church Unit</th>}
                  <th className="text-left p-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{m.first_name} {m.last_name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
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
                            <DropdownMenuItem onClick={() => handleDelete(m)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          )}
                          {!canEditMember(m) && (
                            <DropdownMenuItem disabled className="text-muted-foreground">View only</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={(isAdmin || viewOnly) ? 5 : 4} className="p-8 text-center text-muted-foreground">No members found</td></tr>
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
    </div>
  );
}
