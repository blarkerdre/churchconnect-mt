import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Plus, FileBarChart, Loader2, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import UnitTaskFormDialog from "@/components/unitTasks/UnitTaskFormDialog";
import UnitTaskDetailPanel from "@/components/unitTasks/UnitTaskDetailPanel";
import UnitTaskReportDialog from "@/components/unitTasks/UnitTaskReportDialog";

const priorityColor = {
  Urgent: "bg-destructive/10 text-destructive",
  High: "bg-chart-5/10 text-chart-5",
  Medium: "bg-accent/10 text-accent",
  Low: "bg-muted text-muted-foreground",
};
const statusColor = {
  Open: "bg-primary/10 text-primary",
  Completed: "bg-chart-3/10 text-chart-3",
  Cancelled: "bg-muted text-muted-foreground",
};
const assignStatusColor = {
  Pending: "bg-accent/10 text-accent",
  Acknowledged: "bg-primary/10 text-primary",
  Completed: "bg-chart-3/10 text-chart-3",
};

export default function UnitTasks() {
  const { user, isAdmin, isUnitLeader, leaderUnits, roles } = useAuth();
  const { tenantId } = useTenantQuery();
  const isSuperAdmin = roles.includes("super_admin");
  const canLead = isAdmin || isUnitLeader || isSuperAdmin;

  // Units the user can lead/manage
  const { data: allUnits = [] } = useQuery({
    queryKey: ["active-units-for-tasks", tenantId, isAdmin],
    enabled: !!tenantId && canLead,
    queryFn: async () => {
      if (isAdmin || isSuperAdmin) {
        const { data, error } = await supabase.rpc("get_active_church_unit_names", { _tenant_id: tenantId });
        if (error) return [];
        return (data || []).map((r) => r.name || r.unit_name || r).filter(Boolean);
      }
      return leaderUnits || [];
    },
  });

  const [activeTab, setActiveTab] = useState(canLead ? "leading" : "mine");
  const [unitFilter, setUnitFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("Open");
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // Tasks for "Leading" tab
  const { data: leadTasks = [], isLoading: leadLoading, refetch: refetchLead } = useQuery({
    queryKey: ["leading-tasks", tenantId, unitFilter, statusFilter, allUnits.join("|")],
    enabled: !!tenantId && canLead,
    queryFn: async () => {
      let q = supabase
        .from("unit_tasks")
        .select("*, unit_task_assignments(id, status)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (unitFilter !== "All") q = q.eq("unit_name", unitFilter);
      else if (!isAdmin && !isSuperAdmin) q = q.in("unit_name", allUnits.length ? allUnits : ["__none__"]);
      if (statusFilter !== "All") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // My assignments
  const { data: myAssignments = [], isLoading: mineLoading, refetch: refetchMine } = useQuery({
    queryKey: ["my-assignments", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_task_assignments")
        .select("*, unit_tasks(*)")
        .eq("tenant_id", tenantId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const mineGrouped = useMemo(() => {
    const buckets = { Pending: [], Acknowledged: [], Completed: [] };
    myAssignments.forEach((a) => {
      if (!a.unit_tasks) return;
      (buckets[a.status] || buckets.Pending).push(a);
    });
    return buckets;
  }, [myAssignments]);

  const onChanged = () => { refetchLead(); refetchMine(); };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Unit Tasks</h1>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {canLead && (
            <>
              <Button variant="outline" onClick={() => setReportOpen(true)}>
                <FileBarChart className="h-4 w-4 mr-2" /> Report
              </Button>
              <Button onClick={() => setFormOpen(true)} disabled={!allUnits.length}>
                <Plus className="h-4 w-4 mr-2" /> New Task
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {canLead && <TabsTrigger value="leading">Leading</TabsTrigger>}
          <TabsTrigger value="mine">My Tasks ({myAssignments.filter((a) => a.status !== "Completed").length})</TabsTrigger>
        </TabsList>

        {canLead && (
          <TabsContent value="leading" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3">
              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All my units</SelectItem>
                  {allUnits.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All statuses</SelectItem>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {leadLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : leadTasks.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks yet. Create one to get started.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {leadTasks.map((t) => {
                  const total = t.unit_task_assignments?.length || 0;
                  const done = (t.unit_task_assignments || []).filter((a) => a.status === "Completed").length;
                  const ack = (t.unit_task_assignments || []).filter((a) => a.status !== "Pending").length;
                  return (
                    <Card key={t.id} className="cursor-pointer hover:shadow-md transition" onClick={() => setSelected(t)}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold truncate">{t.title}</h3>
                            <p className="text-xs text-muted-foreground">{t.unit_name}{t.due_date ? ` · due ${t.due_date}` : ""}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {t.description && <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge className={priorityColor[t.priority]}>{t.priority}</Badge>
                          <Badge className={statusColor[t.status]}>{t.status}</Badge>
                          <span className="text-muted-foreground ml-auto">{ack}/{total} ack · {done} done</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="mine" className="space-y-4 mt-4">
          {mineLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : myAssignments.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No tasks assigned to you.</CardContent></Card>
          ) : (
            ["Pending", "Acknowledged", "Completed"].map((bucket) => (
              mineGrouped[bucket].length > 0 && (
                <div key={bucket} className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">{bucket} ({mineGrouped[bucket].length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {mineGrouped[bucket].map((a) => (
                      <Card key={a.id} className="cursor-pointer hover:shadow-md transition" onClick={() => setSelected(a.unit_tasks)}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold truncate">{a.unit_tasks.title}</h3>
                              <p className="text-xs text-muted-foreground">
                                {a.unit_tasks.unit_name}{a.unit_tasks.due_date ? ` · due ${a.unit_tasks.due_date}` : ""}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {a.unit_tasks.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{a.unit_tasks.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge className={priorityColor[a.unit_tasks.priority]}>{a.unit_tasks.priority}</Badge>
                            <Badge className={assignStatusColor[a.status]}>{a.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            ))
          )}
        </TabsContent>
      </Tabs>

      <UnitTaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        unitOptions={allUnits}
        defaultUnit={unitFilter !== "All" ? unitFilter : ""}
        onSaved={onChanged}
      />
      <UnitTaskReportDialog open={reportOpen} onOpenChange={setReportOpen} unitOptions={allUnits} />
      <UnitTaskDetailPanel
        open={!!selected}
        onOpenChange={(v) => !v && setSelected(null)}
        task={selected}
        canManage={canLead && selected && (isAdmin || isSuperAdmin || (leaderUnits || []).some((u) => u.toLowerCase() === (selected.unit_name || "").toLowerCase()))}
        onChanged={onChanged}
      />
    </div>
  );
}
