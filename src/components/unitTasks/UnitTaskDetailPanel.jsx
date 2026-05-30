import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, MessageSquare, Trash2, XCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "sonner";

const statusBadge = {
  Pending: "bg-accent/10 text-accent",
  Acknowledged: "bg-primary/10 text-primary",
  Completed: "bg-chart-3/10 text-chart-3",
};

export default function UnitTaskDetailPanel({ open, onOpenChange, task, canManage, onChanged }) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

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

  // Realtime updates for this task
  useEffect(() => {
    if (!taskId || !open) return;
    const ch = supabase
      .channel(`task-${taskId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "unit_task_assignments", filter: `task_id=eq.${taskId}` }, () => refetchA())
      .on("postgres_changes", { event: "*", schema: "public", table: "unit_task_comments", filter: `task_id=eq.${taskId}` }, () => refetchC())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId, open, refetchA, refetchC]);

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

          {/* Assignees list (leader/admin view) */}
          {canManage && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Assignees</h4>
              <div className="border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{a.members ? `${a.members.first_name} ${a.members.last_name}` : "—"}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className={statusBadge[a.status]}>{a.status}</Badge>
                      {a.acknowledged_at && <span className="text-muted-foreground">ack {new Date(a.acknowledged_at).toLocaleDateString()}</span>}
                      {a.completed_at && <span className="text-muted-foreground">done {new Date(a.completed_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                ))}
                {assignments.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No assignees.</p>}
              </div>
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
        <DialogFooter className="gap-2">
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
