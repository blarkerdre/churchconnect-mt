import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Lock, Download } from "lucide-react";
import PrintReportButton from "@/components/PrintReportButton";
import { Skeleton } from "@/components/ui/skeleton";
import MemberTable from "@/components/members/MemberTable";
import MemberFormDialog from "@/components/members/MemberFormDialog";
import ReEngagementDialog from "@/components/analytics/ReEngagementDialog";

export default function Members() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [emailTarget, setEmailTarget] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const isUnitLeader = currentUser?.role === "unit_leader";

  // Fetch the unit leader's own member record to know their church_units
  const { data: myMemberArr = [] } = useQuery({
    queryKey: ["my-member-unit", currentUser?.email],
    queryFn: () => base44.entities.Member.filter({ email: currentUser.email }),
    enabled: !!(currentUser?.email && (isUnitLeader || !isAdmin)),
  });
  const myUnits = myMemberArr[0]?.church_units || [];
  const isRegularUser = currentUser?.role === "user";

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => base44.entities.Member.list("-created_date", 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Member.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Member.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["members"] }),
  });

  const handleSave = async (data) => {
    if (editingMember) {
      await updateMutation.mutateAsync({ id: editingMember.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setEditingMember(null);
  };

  const handleDownloadCSV = () => {
    const title = isUnitLeader ? `Members — ${myUnits.join(", ")}` : "All Members";
    const headers = ["First Name", "Last Name", "Email", "Phone", "Status", "Gender", "Church Units", "Water Baptism", "WSF", "HS Baptism", "BFC", "Join Date"];
    const rows = filtered.map(m => [
      m.first_name,
      m.last_name,
      m.email || "",
      m.phone || "",
      m.membership_status || "",
      m.gender || "",
      (m.church_units || []).join("; "),
      m.water_baptism ? "Yes" : "No",
      m.winners_satellite ? "Yes" : "No",
      m.holy_spirit_baptism ? "Yes" : "No",
      m.bfc_completed ? "Yes" : "No",
      m.join_date || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = members.filter((m) => {
    const matchSearch = `${m.first_name} ${m.last_name} ${m.email || ""} ${m.phone || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.membership_status === statusFilter;
    // Unit leaders and regular users only see members of their units
    let matchUnit = true;
    if (isUnitLeader && myUnits.length > 0) {
      matchUnit = (m.church_units || []).some(u => myUnits.includes(u));
    }
    return matchSearch && matchStatus && matchUnit;
  });

  return (
    <div className="space-y-6">
      {isUnitLeader && myUnits.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>Viewing members in: <strong>{myUnits.join(", ")}</strong></span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
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
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isUnitLeader) && (
            <>
              <PrintReportButton
                label="Print Report"
                buildRows={() => ({
                  title: isUnitLeader ? `Members Report — ${myUnits.join(", ")}` : "Members Report",
                  headers: ["Name", "Status", "Email", "Phone", "Units"],
                  rows: filtered.map(m => [
                    `${m.first_name} ${m.last_name}`,
                    m.membership_status || "",
                    m.email || "",
                    m.phone || "",
                    (m.church_units || []).join(", "),
                  ]),
                })}
              />
              <Button variant="outline" size="sm" onClick={handleDownloadCSV} className="gap-1.5">
                <Download className="h-4 w-4" /> Download CSV
              </Button>
            </>
          )}
          {isAdmin && (
            <Button onClick={() => { setEditingMember(null); setDialogOpen(true); }} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
              <Plus className="h-4 w-4 mr-2" /> Register Member
            </Button>
          )}
        </div>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : (
          <MemberTable
            members={filtered}
            readOnly={isUnitLeader}
            canDelete={isAdmin}
            onEdit={(m) => { setEditingMember(m); setDialogOpen(true); }}
            onDelete={(m) => { if (window.confirm(`Delete ${m.first_name} ${m.last_name}?`)) deleteMutation.mutate(m.id); }}
            onEmail={(m) => setEmailTarget({ id: m.id, name: `${m.first_name} ${m.last_name}`, email: m.email })}
          />
        )}
      </Card>

      {isAdmin && (
        <MemberFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          member={editingMember}
          onSave={handleSave}
        />
      )}

      {emailTarget && (
        <ReEngagementDialog
          open={!!emailTarget}
          onOpenChange={(v) => { if (!v) setEmailTarget(null); }}
          member={emailTarget}
        />
      )}
    </div>
  );
}