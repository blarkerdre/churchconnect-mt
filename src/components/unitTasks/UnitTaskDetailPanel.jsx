import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, MessageSquare, Trash2, XCircle, Pencil, UserPlus, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

const statusBadge = {
  Pending: "bg-accent/10 text-accent",
  Acknowledged: "bg-primary/10 text-primary",
  Completed: "bg-chart-3/10 text-chart-3",
};

export default function UnitTaskDetailPanel({ open, onOpenChange, task, canManage, onEdit, onChanged }) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [adding, setAdding] = useState(false);

  const taskId = task?.id;

  const { data: assignments = [], refetch: refetchA } = useQuery({
    queryKey: ["task-assignments", taskId],
    enabled: !!taskId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_task_assignments")
        .select("*, members(first_name, last_name)")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: comments = [], refetch: refetchC } = useQuery({
    queryKey: ["task-comments", taskId],
    enabled: !!taskId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // Candidates for reassignment: unit members not already assigned
  const assignedMemberIds = useMemo(
    () => new Set(assignments.map((a) => a.member_id).filter(Boolean)),
    [assignments]
  );
  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ["task-candidates", tenantId, task?.unit_name, assignedMemberIds.size],
    enabled: !!tenantId && !!task?.unit_name && showAdd && canManage,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, user_id, church_unit")
        .eq("tenant_id", tenantId)
        .ilike("church_unit", `%${task.unit_name}%`)
        .order("first_name");
      if (error) throw error;
      const needle = (task.unit_name || "").trim().toLowerCase();
      return (data || []).filter((m) =>
        (m.church_unit || "").split(",").map((s) => s.trim().toLowerCase()).includes(needle)
        && !assignedMemberIds.has(m.id)
      );
    },
  });

  // Realtime
  useEffect(() => {
    if (!taskId || !open || !tenantId) return;
    const ch = supabase
      .channel(`task-${taskId}-${tenantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "unit_task_assignments", filter: `tenant_id=eq.${tenantId}` }, (p) => {
        if (p.new?.task_id === taskId || p.old?.task_id === taskId) refetchA();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "unit_task_comments", filter: `tenant_id=eq.${tenantId}` }, (p) => {
        if (p.new?.task_id === taskId || p.old?.task_id === taskId) refetchC();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, open, tenantId, refetchA, refetchC]);

  useEffect(() => {
    if (!open) { setShowAdd(false); setPicked(new Set()); }
  }, [open]);

  const myAssignment = assignments.find((a) => a.user_id === user?.id);

  const updateMyStatus = async (status) => {
    if (!myAssignment) return;
    const patch = { status };
    if (status === "Acknowledged") patch.acknowledged_at = new Date().toISOString();
    if (status === "Completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase
      .from("unit_task_assignments")
      .update(patch)
      .eq("id", myAssignment.id)
      .eq("tenant_id", tenantId);
    if (error) return toast.error(error.message);
    toast.success(`Marked as ${status}`);
    refetchA();
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("unit_task_comments").insert({
      tenant_id: tenantId,
      task_id: taskId,
      author_id: user.id,
      body: comment.trim(),
    });
    setPosting(false);
    if (error) return toast.error(error.message);
    setComment("");
    refetchC();
  };

  const cancelTask = async () => {
    if (!confirm("Cancel this task for everyone?")) return;
    const { error } = await supabase
      .from("unit_tasks")
      .update({ status: "Cancelled" })
      .eq("id", taskId)
      .eq("tenant_id", tenantId);
    if (error) return toast.error(error.message);
    toast.success("Task cancelled");
    onChanged?.();
    onOpenChange(false);
  };

  const deleteTask = async () => {
    if (!confirm("Delete this task and all its assignments? This cannot be undone.")) return;
    const { error } = await supabase.from("unit_tasks").delete().eq("id", taskId).eq("tenant_id", tenantId);
    if (error) return toast.error(error.message);
    toast.success("Task deleted");
    onChanged?.();
    onOpenChange(false);
  };

  const togglePick = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addAssignees = async () => {
    if (picked.size === 0) return;
    setAdding(true);
    try {
      const rows = candidates
        .filter((m) => picked.has(m.id))
        .map((m) => ({
          tenant_id: tenantId,
          task_id: taskId,
          member_id: m.id,
          user_id: m.user_id || null,
          status: "Pending",
        }));
      const { error } = await supabase.from("unit_task_assignments").insert(rows);
      if (error) throw error;

      // Best-effort notification
      try {
        supabase.functions.invoke("notify-unit-task-assignment", {
          body: { task_id: taskId, tenant_id: tenantId },
        }).catch(() => {});
      } catch { /* noop */ }

      try { logAudit("unit_task.reassigned", "unit_task", taskId, { added: rows.length }, tenantId); } catch { /* noop */ }

      toast.success(`Added ${rows.length} assignee${rows.length === 1 ? "" : "s"}`);
      setPicked(new Set());
      setShowAdd(false);
      refetchA();
      qc.invalidateQueries({ queryKey: ["leading-tasks"] });
    } catch (err) {
      toast.error(err?.message || "Failed to add assignees");
    } finally {
      setAdding(false);
    }
  };

  const removeAssignee = async (a) => {
    if (a.status !== "Pending" && !confirm(`Remove ${a.members ? `${a.members.first_name} ${a.members.last_name}` : "this assignee"}? Their progress will be lost.`)) return;
    const { error } = await supabase
      .from("unit_task_assignments")
      .delete()
      .eq("id", a.id)
      .eq("tenant_id", tenantId);
    if (error) return toast.error(error.message);
    try { logAudit("unit_task.reassigned", "unit_task", taskId, { removed: 1, member_id: a.member_id }, tenantId); } catch { /* noop */ }
    toast.success("Assignee removed");
    refetchA();
    qc.invalidateQueries({ queryKey: ["leading-tasks"] });
  };

  if (!task) return null;

  const counts = assignments.reduce(
    (a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; },
    { Pending: 0, Acknowledged: 0, Completed: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <TenantDialogHeader>{task.title}</TenantDialogHeader>
        <div className="space-y-5 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{task.unit_name}</Badge>
            <Badge variant="outline">{task.priority}</Badge>
            <Badge variant="outline">{task.status}</Badge>
            {task.due_date && <span className="text-muted-foreground">Due {task.due_date}</span>}
            <span className="text-muted-foreground ml-auto">
              {counts.Acknowledged + counts.Completed}/{assignments.length} acknowledged · {counts.Completed} done
            </span>
          </div>
          {task.description && (
            <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/40 rounded-md p-3">{task.description}</p>
          )}

          {myAssignment && task.status === "Open" && (
            <div className="flex flex-wrap gap-2 border border-border rounded-md p-3 bg-muted/30">
              <span className="text-sm font-medium mr-auto">Your status: <Badge className={statusBadge[myAssignment.status]}>{myAssignment.status}</Badge></span>
              {myAssignment.status === "Pending" && (
                <Button size="sm" variant="outline" onClick={() => updateMyStatus("Acknowledged")}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Acknowledge
                </Button>
              )}
              {myAssignment.status !== "Completed" && (
                <Button size="sm" onClick={() => updateMyStatus("Completed")}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Complete
                </Button>
              )}
            </div>
          )}

          {canManage && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Assignees</h4>
                {task.status === "Open" && (
                  <Button size="sm" variant="outline" onClick={() => setShowAdd((v) => !v)}>
                    <UserPlus className="h-4 w-4 mr-1" /> {showAdd ? "Close" : "Add members"}
                  </Button>
                )}
              </div>
              <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 text-sm gap-2">
                    <span className="min-w-0 truncate">{a.members ? `${a.members.first_name} ${a.members.last_name}` : "—"}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className={statusBadge[a.status]}>{a.status}</Badge>
                      {a.acknowledged_at && <span className="text-muted-foreground hidden sm:inline">ack {new Date(a.acknowledged_at).toLocaleDateString()}</span>}
                      {a.completed_at && <span className="text-muted-foreground hidden sm:inline">done {new Date(a.completed_at).toLocaleDateString()}</span>}
                      {task.status === "Open" && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeAssignee(a)} title="Remove assignee">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {assignments.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No assignees.</p>}
              </div>

              {showAdd && task.status === "Open" && (
                <div className="border border-border rounded-md p-2 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{picked.size} selected · {candidates.length} available in {task.unit_name}</span>
                    <Button size="sm" onClick={addAssignees} disabled={adding || picked.size === 0}>
                      {adding && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Add {picked.size > 0 ? `(${picked.size})` : ""}
                    </Button>
                  </div>
                  <ScrollArea className="h-48 border border-border rounded bg-background">
                    {candidatesLoading ? (
                      <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : candidates.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-6">No other members in this unit.</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {candidates.map((m) => (
                          <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                            <Checkbox checked={picked.has(m.id)} onCheckedChange={() => togglePick(m.id)} />
                            <span className="text-sm">{m.first_name} {m.last_name}</span>
                            {!m.user_id && <span className="text-xs text-muted-foreground ml-auto">no login</span>}
                          </label>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Comments</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : comments.map((c) => (
                <div key={c.id} className="text-sm bg-muted/40 rounded-md p-2">
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea rows={2} placeholder="Write a comment…" value={comment} onChange={(e) => setComment(e.target.value)} />
              <Button onClick={postComment} disabled={posting || !comment.trim()}>
                {posting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Post
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 flex-wrap">
          {canManage && task.status === "Open" && onEdit && (
            <Button variant="outline" onClick={() => onEdit(task)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {canManage && task.status === "Open" && (
            <Button variant="outline" onClick={cancelTask}><XCircle className="h-4 w-4 mr-1" /> Cancel Task</Button>
          )}
          {canManage && (
            <Button variant="outline" className="text-destructive" onClick={deleteTask}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
