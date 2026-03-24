import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartHandshake, Search, Phone, MessageSquare, CalendarCheck, Plus, AlertCircle, Loader2, UserCheck, User, Download } from "lucide-react";
import PrintReportButton from "@/components/PrintReportButton";
import SMSDialog from "@/components/sms/SMSDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import FollowupFormDialog from "@/components/followups/FollowupFormDialog";
import FollowupDetailPanel from "@/components/followups/FollowupDetailPanel";
import OverdueReminder from "@/components/followups/OverdueReminder";
import { useSubFeature } from "@/hooks/useSubFeature";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const priorityColors = { "Urgent": "bg-destructive/10 text-destructive", "High": "bg-chart-5/10 text-chart-5", "Medium": "bg-accent/10 text-accent", "Low": "bg-muted text-muted-foreground" };
const statusColors = { "Pending": "bg-accent/10 text-accent", "In Progress": "bg-primary/10 text-primary", "Completed": "bg-chart-3/10 text-chart-3", "Overdue": "bg-destructive/10 text-destructive" };
const typeIcons = { "First Timer": MessageSquare, "Absentee": AlertCircle, "New Convert": HeartHandshake, "Pastoral": Phone, "General": CalendarCheck };

export default function Followups() {
  const { user, isAdmin, isUnitLeader, profile } = useAuth();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState(null);
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [smsFollowup, setSmsFollowup] = useState(null);
  const queryClient = useQueryClient();
  const { enabled: canCreateFollowup } = useSubFeature("followups.create");
  const { enabled: canSmsFollowup } = useSubFeature("followups.sms");

  // Fetch profiles for resolving assigned_to user IDs to names
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, email");
      if (error) throw error;
      return data;
    },
  });

  const profileMap = React.useMemo(() => {
    const map = {};
    profiles.forEach(p => { map[p.user_id] = p.full_name || p.email || "Unknown"; });
    return map;
  }, [profiles]);

  // Fetch follow-up unit members for reassignment
  const { data: followupUnitMembers = [] } = useQuery({
    queryKey: ["followup-unit-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_leader_assignments")
        .select("user_id")
        .in("unit_name", ["Follow-up", "Follow-Up", "follow-up"]);
      if (error) throw error;
      return data.map(d => d.user_id);
    },
  });

  // Fetch followups with member info
  const { data: followups = [], isLoading } = useQuery({
    queryKey: ["followups", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("followups")
          .select("*, members(first_name, last_name, email, phone, membership_status)")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data.map(f => ({
        ...f,
        person_name: f.members ? `${f.members.first_name} ${f.members.last_name}` : "Unknown",
        person_email: f.members?.email,
        person_phone: f.members?.phone,
        person_status: f.members?.membership_status,
      }));
    },
  });

  // Fetch members for the form
  const { data: members = [] } = useQuery({
    queryKey: ["members-list", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("members").select("id, first_name, last_name, email, phone, membership_status, church_unit").order("first_name"));
      if (error) throw error;
      return data;
    },
  });

  // Save followup (create or update)
  const saveMutation = useMutation({
    mutationFn: async (form) => {
      const payload = {
        member_id: form.member_id || null,
        followup_type: form.category || "General",
        description: form.type || null,
        notes: form.notes || null,
        priority: form.priority || "Medium",
        status: form.status || "Pending",
        due_date: form.due_date || form.scheduled_date || null,
        completed_date: form.completed_date || null,
        assigned_to: form.assigned_to_id || null,
        created_by: user?.id,
      };

      if (form.id) {
        const { error } = await supabase.from("followups").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("followups").insert(withTenant(payload));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      toast({ title: "Follow-up saved" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Update followup fields (from detail panel)
  const handleUpdateFollowup = async (id, patch) => {
    const { error } = await supabase.from("followups").update(patch).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["followups"] });
    // Refresh selected followup
    const updated = followups.find(f => f.id === id);
    if (updated) setSelectedFollowup({ ...updated, ...patch });
  };

  // Convert member to Active
  const convertMutation = useMutation({
    mutationFn: async ({ memberId, followupId, personName }) => {
      const { error: memberErr } = await supabase
        .from("members")
        .update({ membership_status: "Active" })
        .eq("id", memberId);
      if (memberErr) throw memberErr;

      const { error: fuErr } = await supabase
        .from("followups")
        .update({
          status: "Completed",
          completed_date: new Date().toISOString().split("T")[0],
          notes: `${personName} has been converted to Active Member.`,
        })
        .eq("id", followupId);
      if (fuErr) throw fuErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast({ title: "Member converted to Active!" });
      setSelectedFollowup(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = followups.filter(f => {
    const matchSearch = `${f.person_name} ${f.followup_type} ${f.description || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || f.status === statusFilter;
    const dateOnly = f.due_date || f.created_at?.split("T")[0];
    const matchDate = (!dateFrom || dateOnly >= dateFrom) && (!dateTo || dateOnly <= dateTo);
    return matchSearch && matchStatus && matchDate;
  });

  const downloadCSV = () => {
    const headers = ["Name", "Type", "Status", "Priority", "Assigned To", "Due Date", "Completed Date", "Notes"];
    const rows = filtered.map(f => [
      f.person_name,
      f.followup_type,
      f.status,
      f.priority || "",
      f.assigned_to ? (profileMap[f.assigned_to] || "Unassigned") : "Unassigned",
      f.due_date || "",
      f.completed_date || "",
      (f.notes || f.description || "").replace(/,/g, " "),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `followups_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const overdueTasks = followups.filter(f =>
    f.due_date && f.status !== "Completed" && f.status !== "Overdue" && new Date(f.due_date) < new Date()
  );

  const openNew = () => { setEditingFollowup(null); setDialogOpen(true); };

  // Map followup to form format for editing
  const openEdit = (f) => {
    setEditingFollowup({
      id: f.id,
      member_id: f.member_id,
      person_name: f.person_name,
      category: f.followup_type,
      type: f.description || "Phone Call",
      assigned_to: "", // We don't store name, just ID
      assigned_to_id: f.assigned_to || "",
      status: f.status,
      priority: f.priority || "Medium",
      scheduled_date: f.due_date || "",
      due_date: f.due_date || "",
      completed_date: f.completed_date || "",
      notes: f.notes || "",
    });
    setDialogOpen(true);
  };

  // Map detail panel followup format
  const mapForDetail = (f) => ({
    ...f,
    category: f.followup_type,
    type: f.description || "General",
    assigned_to: f.assigned_to || "Unassigned",
    assigned_to_name: f.assigned_to ? (profileMap[f.assigned_to] || "Unknown") : "Unassigned",
    scheduled_date: f.due_date,
  });

  return (
    <div className="space-y-6">
      {/* Overdue reminder */}
      <OverdueReminder
        overdueTasks={overdueTasks.map(f => ({ ...f, person_name: f.person_name, due_date: f.due_date }))}
        onSelectTask={(t) => setSelectedFollowup(mapForDetail(followups.find(f => f.id === t.id)))}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-foreground">{filtered.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-accent">{filtered.filter(f => f.status === "Pending").length}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-primary">{filtered.filter(f => f.status === "In Progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-chart-3">{filtered.filter(f => f.status === "Completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 flex-wrap">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search follow-ups..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          {(isAdmin || isUnitLeader) && (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["All", "Pending", "In Progress", "Completed", "Overdue"].map(s => <SelectItem key={s} value={s}>{s === "All" ? "All Status" : s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-40" placeholder="From" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-40" placeholder="To" />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateFollowup && <Button onClick={openNew} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" /> New Follow-up</Button>}
          {(isAdmin || isUnitLeader) && (
            <>
              <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-2" /> Download</Button>
              <PrintReportButton
                label="Print"
                buildRows={() => ({
                  title: "Follow-ups Report",
                  headers: ["Name", "Type", "Status", "Priority", "Assigned To", "Due Date", "Completed", "Notes"],
                  rows: filtered.map(f => [
                    f.person_name,
                    f.followup_type,
                    f.status,
                    f.priority || "",
                    f.assigned_to ? (profileMap[f.assigned_to] || "Unassigned") : "Unassigned",
                    f.due_date || "",
                    f.completed_date || "",
                    f.notes || f.description || "",
                  ]),
                })}
              />
            </>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => {
            const Icon = typeIcons[f.followup_type] || HeartHandshake;
            const isOverdue = f.due_date && f.status !== "Completed" && new Date(f.due_date) < new Date();
            const isConvertible = ["First Timer", "New Convert"].includes(f.person_status) && f.member_id;

            return (
              <Card
                key={f.id}
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedFollowup(mapForDetail(f))}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-display font-bold text-foreground">{f.person_name}</h3>
                        <Badge className={`border-0 ${priorityColors[f.priority] || ""}`}>{f.priority}</Badge>
                        <Badge className={`border-0 ${statusColors[f.status] || ""}`}>{f.status}</Badge>
                        {isOverdue && <Badge className="border-0 bg-destructive/10 text-destructive">Overdue</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{f.notes || f.description || "No notes"}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{f.followup_type}</span>
                        {f.assigned_to && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {profileMap[f.assigned_to] || "Unassigned"}
                          </span>
                        )}
                        {f.due_date && (
                          <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> {f.due_date}</span>
                        )}
                        {isConvertible && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Convert ${f.person_name} to Active Member?`)) {
                                convertMutation.mutate({ memberId: f.member_id, followupId: f.id, personName: f.person_name });
                              }
                            }}
                            className="flex items-center gap-1 text-primary font-medium hover:underline"
                          >
                            <UserCheck className="h-3 w-3" /> Convert to Member
                          </button>
                        )}
                         {f.person_phone && canSmsFollowup && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSmsFollowup(f);
                            }}
                            className="flex items-center gap-1 text-primary font-medium hover:underline"
                          >
                            <MessageSquare className="h-3 w-3" /> SMS Reminder
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card className="border-0 shadow-sm p-16 text-center text-muted-foreground">
              <HeartHandshake className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium">No follow-ups found</p>
            </Card>
          )}
        </div>
      )}

      {/* Form Dialog */}
      <FollowupFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        followup={editingFollowup}
        onSave={(form) => saveMutation.mutateAsync(form)}
        members={members}
      />

      {/* Detail Panel */}
      {selectedFollowup && (
        <FollowupDetailPanel
          followup={selectedFollowup}
          onClose={() => setSelectedFollowup(null)}
          onUpdate={handleUpdateFollowup}
          currentUser={profile}
          isAdmin={isAdmin}
          profileMap={profileMap}
          followupUnitMembers={followupUnitMembers}
          onConverted={() => {
            queryClient.invalidateQueries({ queryKey: ["followups"] });
            queryClient.invalidateQueries({ queryKey: ["members"] });
          }}
        />
      )}

      {smsFollowup && (
        <SMSDialog
          open={!!smsFollowup}
          onOpenChange={(o) => { if (!o) setSmsFollowup(null); }}
          prefillMessage={`Hi ${smsFollowup.person_name}, this is a follow-up reminder from church. ${smsFollowup.description || smsFollowup.notes || ''}`}
          smsType="followup"
          referenceId={smsFollowup.id}
          directRecipients={[{ phone: smsFollowup.person_phone, member_id: smsFollowup.member_id, name: smsFollowup.person_name }]}
          title="SMS Follow-up Reminder"
        />
      )}
    </div>
  );
}
