import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Heart, LayoutDashboard, List, UserCheck } from "lucide-react";
import PrintReportButton from "@/components/PrintReportButton";
import { Skeleton } from "@/components/ui/skeleton";
import PastoralCareFormDialog from "@/components/pastoralcare/PastoralCareFormDialog";
import PastoralCareCard from "@/components/pastoralcare/PastoralCareCard";
import LeaderDashboard from "@/components/pastoralcare/LeaderDashboard";
import BulkAssignDialog from "@/components/pastoralcare/BulkAssignDialog";

const CATEGORIES = [
  "All", "Prayer Request", "Counselling Session", "Visitation", "Hospital Visit",
  "Bereavement Support", "Marriage Support", "Financial Support",
  "Spiritual Direction", "General Pastoral Need", "Other"
];

export default function PastoralCare() {
  const [currentUser, setCurrentUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);
  const isPastoralCareLeader = currentUser?.role === "unit_leader";

  const [tab, setTab] = useState("dashboard");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [leaderFilter, setLeaderFilter] = useState("all");

  const queryClient = useQueryClient();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["pastoral_care"],
    queryFn: () => base44.entities.PastoralCare.list("-date_logged", 200),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => base44.entities.Member.list("-created_date", 200),
  });

  // Members in the Pastoral Care unit — available as assignees
  const pastoralCareMembers = members.filter(m =>
    (m.church_units || []).includes("Pastoral Care")
  );

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PastoralCare.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pastoral_care"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PastoralCare.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pastoral_care"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PastoralCare.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pastoral_care"] }),
  });

  const handleSave = async (data) => {
    if (editingRecord) {
      await updateMutation.mutateAsync({ id: editingRecord.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setEditingRecord(null);
  };

  const handleBulkAssign = async (ids, leaderName) => {
    await Promise.all(
      ids.map((id) => updateMutation.mutateAsync({ id, data: { assigned_leader: leaderName } }))
    );
  };

  const handleEdit = (rec) => {
    setEditingRecord(rec);
    setDialogOpen(true);
    setTab("records"); // Switch to records tab when editing from dashboard
  };

  // Build leader list from records
  const leaderOptions = [...new Set(records.map((r) => r.assigned_leader).filter(Boolean))].sort();

  const filtered = records.filter((r) => {
    const matchSearch = `${r.member_name} ${r.title} ${r.assigned_leader || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchCat = categoryFilter === "All" || r.category === categoryFilter;
    const matchLeader = leaderFilter === "all" || r.assigned_leader === leaderFilter || (leaderFilter === "__unassigned__" && !r.assigned_leader);
    return matchSearch && matchStatus && matchCat && matchLeader;
  });

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div /> {/* spacer */}
        <div className="flex items-center gap-2">
          <PrintReportButton
            label="Print Report"
            buildRows={() => ({
              title: "Pastoral Care Report",
              headers: ["Member", "Category", "Title", "Assigned To", "Status", "Priority", "Date Logged"],
              rows: records.map(r => [
                r.member_name,
                r.category || "",
                r.title || "",
                r.assigned_leader || "Unassigned",
                r.status || "",
                r.priority || "",
                r.date_logged || "",
              ]),
            })}
          />
          <Button
            variant="outline"
            onClick={() => setBulkOpen(true)}
            className="border-[#1e3a5f] text-[#1e3a5f] hover:bg-[#1e3a5f]/5"
          >
            <UserCheck className="h-4 w-4 mr-2" /> Bulk Assign
          </Button>
          <Button
            onClick={() => { setEditingRecord(null); setDialogOpen(true); }}
            className="bg-[#1e3a5f] hover:bg-[#152d4a]"
          >
            <Plus className="h-4 w-4 mr-2" /> Log Pastoral Need
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="dashboard" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="records" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <List className="h-3.5 w-3.5" /> All Records
          </TabsTrigger>
        </TabsList>

        {/* ── Dashboard Tab ── */}
        <TabsContent value="dashboard" className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
          ) : (
            <LeaderDashboard records={records} onEdit={handleEdit} />
          )}
        </TabsContent>

        {/* ── Records Tab ── */}
        <TabsContent value="records" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by member, title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={leaderFilter} onValueChange={setLeaderFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Leaders" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leaders</SelectItem>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {leaderOptions.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Records */}
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Heart className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No pastoral care records found</p>
              <p className="text-sm mt-1">Click "Log Pastoral Need" to add the first record.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <PastoralCareCard
                  key={r.id}
                  record={r}
                  onEdit={(rec) => { setEditingRecord(rec); setDialogOpen(true); }}
                  onDelete={(rec) => { if (window.confirm(`Delete this pastoral care record for ${rec.member_name}?`)) deleteMutation.mutate(rec.id); }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PastoralCareFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        record={editingRecord}
        members={members}
        assignableMembers={isPastoralCareLeader ? pastoralCareMembers : null}
        onSave={handleSave}
      />

      <BulkAssignDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        records={records}
        onAssign={handleBulkAssign}
      />
    </div>
  );
}