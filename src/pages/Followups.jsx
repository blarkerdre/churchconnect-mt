import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, Calendar, User, Clock, Flag, ChevronRight, AlertCircle, Phone, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import FollowupFormDialog from "@/components/followups/FollowupFormDialog";
import FollowupDetailPanel from "@/components/followups/FollowupDetailPanel";
import OverdueReminder from "@/components/followups/OverdueReminder";
import { useCurrentUser } from "@/components/useCurrentUser";

const statusColors = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const priorityColors = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-blue-50 text-blue-600",
  High: "bg-orange-50 text-orange-600",
  Urgent: "bg-red-50 text-red-600",
};

const categoryColors = {
  "New Convert": "bg-purple-50 text-purple-700",
  "First Timer": "bg-indigo-50 text-indigo-700",
  "Pastoral Care": "bg-rose-50 text-rose-700",
  "Membership Inquiry": "bg-cyan-50 text-cyan-700",
  "Bereavement": "bg-slate-100 text-slate-600",
  "Hospital Visit": "bg-orange-50 text-orange-700",
  "General": "bg-slate-50 text-slate-600",
};

const CATEGORIES = ["New Convert", "First Timer", "Pastoral Care", "Membership Inquiry", "Bereavement", "Hospital Visit", "General"];

export default function Followups() {
  const { user } = useCurrentUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailFollowup, setDetailFollowup] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const queryClient = useQueryClient();

  const { data: followups = [], isLoading } = useQuery({
    queryKey: ["followups"],
    queryFn: () => base44.entities.Followup.list("-created_date", 200),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => base44.entities.Member.list("-created_date", 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Followup.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["followups"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Followup.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      // refresh detail panel
      setDetailFollowup(prev => prev ? { ...prev, ...followups.find(f => f.id === prev.id) } : null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Followup.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followups"] });
      setDetailFollowup(null);
    },
  });

  const handleSave = async (data) => {
    if (editing) await updateMutation.mutateAsync({ id: editing.id, data });
    else await createMutation.mutateAsync(data);
    setEditing(null);
  };

  const handleUpdate = async (id, patch) => {
    await updateMutation.mutateAsync({ id, data: patch });
    // update the live detail panel
    setDetailFollowup(prev => prev?.id === id ? { ...prev, ...patch } : prev);
  };

  const isOverdue = (f) =>
    f.due_date && f.status !== "Completed" && f.status !== "Cancelled" && new Date(f.due_date) < new Date();

  const filtered = followups.filter((f) => {
    const matchSearch = `${f.person_name} ${f.assigned_to} ${f.type} ${f.category || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || f.status === statusFilter;
    const matchCategory = categoryFilter === "all" || f.category === categoryFilter;
    return matchSearch && matchStatus && matchCategory;
  });

  const overdueCount = followups.filter(isOverdue).length;
  const overdueTasks = followups.filter(isOverdue);
  // Tasks tab: only First Timer & New Convert follow-ups
  const taskFollowups = followups.filter(f => ["First Timer", "New Convert"].includes(f.category));

  return (
    <div className="space-y-6">
      {/* Overdue Reminder Banner */}
      <OverdueReminder overdueTasks={overdueTasks} onSelectTask={setDetailFollowup} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: followups.length, color: "text-slate-800" },
          { label: "Pending", value: followups.filter(f => f.status === "Pending").length, color: "text-amber-600" },
          { label: "In Progress", value: followups.filter(f => f.status === "In Progress").length, color: "text-blue-600" },
          { label: "Completed", value: followups.filter(f => f.status === "Completed").length, color: "text-emerald-600" },
          { label: "Overdue", value: overdueCount, color: "text-red-600" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="tasks">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
          <TabsList className="bg-slate-100">
            <TabsTrigger value="tasks">
              Follow-up Tasks
              {taskFollowups.filter(f => f.status !== "Completed" && f.status !== "Cancelled").length > 0 && (
                <Badge className="ml-1.5 bg-indigo-600 text-white text-[10px] px-1.5 py-0">
                  {taskFollowups.filter(f => f.status !== "Completed" && f.status !== "Cancelled").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Follow-ups</TabsTrigger>
          </TabsList>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-[#1e3a5f] hover:bg-[#152d4a] shrink-0">
            <Plus className="h-4 w-4 mr-2" /> New Follow-up
          </Button>
        </div>

        {/* --- TASKS TAB (First Timer + New Convert) --- */}
        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
          ) : taskFollowups.filter(f => {
            const matchSearch = `${f.person_name} ${f.assigned_to} ${f.notes || ""}`.toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === "all" || f.status === statusFilter;
            return matchSearch && matchStatus;
          }).length === 0 ? (
            <Card className="border-0 shadow-sm p-12 text-center text-slate-400">
              <p className="font-medium">No First Timer or New Convert follow-up tasks</p>
              <p className="text-xs mt-1">Tasks are auto-created when a First Timer or New Convert is registered</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {taskFollowups.filter(f => {
                const matchSearch = `${f.person_name} ${f.assigned_to} ${f.notes || ""}`.toLowerCase().includes(search.toLowerCase());
                const matchStatus = statusFilter === "all" || f.status === statusFilter;
                return matchSearch && matchStatus;
              }).map((f) => {
                const overdue = isOverdue(f);
                const noteText = f.notes || "";
                const phoneMatch = noteText.match(/Phone:\s*([^\s,]+)/);
                const emailMatch = noteText.match(/Email:\s*([^\s,]+)/);
                return (
                  <Card
                    key={f.id}
                    className={`border-0 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer ${overdue ? "border-l-4 border-l-red-400" : "border-l-4 border-l-indigo-300"}`}
                    onClick={() => setDetailFollowup(f)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-800">{f.person_name}</h3>
                          <Badge variant="secondary" className={`text-xs border ${statusColors[f.status]}`}>{f.status}</Badge>
                          <Badge variant="secondary" className={`text-xs ${priorityColors[f.priority]}`}>{f.priority}</Badge>
                          {f.category && (
                            <Badge variant="secondary" className={`text-xs ${categoryColors[f.category] || "bg-slate-100 text-slate-600"}`}>{f.category}</Badge>
                          )}
                          {overdue && (
                            <Badge className="text-xs bg-red-100 text-red-600 border border-red-200 flex items-center gap-1">
                              <AlertCircle className="h-2.5 w-2.5" /> Overdue
                            </Badge>
                          )}
                        </div>

                        {/* Contact details inline */}
                        {(phoneMatch || emailMatch) && (
                          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                            {phoneMatch && (
                              <a href={`tel:${phoneMatch[1]}`} onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 text-blue-600 hover:underline">
                                <Phone className="h-3 w-3" />{phoneMatch[1]}
                              </a>
                            )}
                            {emailMatch && (
                              <a href={`mailto:${emailMatch[1]}`} onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 text-blue-600 hover:underline">
                                <Mail className="h-3 w-3" />{emailMatch[1]}
                              </a>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{f.assigned_to}</span>
                          {f.due_date && (
                            <span className={`flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : ""}`}>
                              <Flag className="h-3 w-3" />Due: {format(new Date(f.due_date), "dd MMM yyyy")}
                            </span>
                          )}
                          {f.progress_log?.length > 0 && (
                            <span className="text-slate-400">{f.progress_log.length} note{f.progress_log.length !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(f); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm("Delete?")) deleteMutation.mutate(f.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* --- ALL FOLLOW-UPS TAB --- */}
        <TabsContent value="all" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.keys(statusColors).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="border-0 shadow-sm p-16 text-center text-slate-400">
              <p className="text-lg font-medium">No follow-ups found</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map((f) => {
                const overdue = isOverdue(f);
                return (
                  <Card
                    key={f.id}
                    className={`border-0 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer ${overdue ? "border-l-4 border-l-red-400" : ""}`}
                    onClick={() => setDetailFollowup(f)}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-800">{f.person_name}</h3>
                          <Badge variant="secondary" className={`text-xs border ${statusColors[f.status]}`}>{f.status}</Badge>
                          <Badge variant="secondary" className={`text-xs ${priorityColors[f.priority]}`}>{f.priority}</Badge>
                          {f.category && (
                            <Badge variant="secondary" className={`text-xs ${categoryColors[f.category] || "bg-slate-100 text-slate-600"}`}>{f.category}</Badge>
                          )}
                          {overdue && (
                            <Badge className="text-xs bg-red-100 text-red-600 border border-red-200 flex items-center gap-1">
                              <AlertCircle className="h-2.5 w-2.5" /> Overdue
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{f.type}</span>
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{f.assigned_to}</span>
                          {f.scheduled_date && (
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(f.scheduled_date), "dd MMM yyyy")}</span>
                          )}
                          {f.due_date && (
                            <span className={`flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : ""}`}>
                              <Flag className="h-3 w-3" />Due: {format(new Date(f.due_date), "dd MMM yyyy")}
                            </span>
                          )}
                          {f.progress_log?.length > 0 && (
                            <span className="text-slate-400">{f.progress_log.length} note{f.progress_log.length !== 1 ? "s" : ""}</span>
                          )}
                        </div>
                        {f.outcome && <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg px-3 py-2 truncate">{f.outcome}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(f); setDialogOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm("Delete this follow-up?")) deleteMutation.mutate(f.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FollowupFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        followup={editing}
        onSave={handleSave}
        members={members}
      />

      {detailFollowup && (
        <FollowupDetailPanel
          followup={{ ...detailFollowup, ...(followups.find(f => f.id === detailFollowup.id) || {}) }}
          onClose={() => setDetailFollowup(null)}
          onUpdate={handleUpdate}
          currentUser={user}
          onConverted={() => {
            queryClient.invalidateQueries({ queryKey: ["members"] });
            setDetailFollowup(null);
          }}
        />
      )}
    </div>
  );
}