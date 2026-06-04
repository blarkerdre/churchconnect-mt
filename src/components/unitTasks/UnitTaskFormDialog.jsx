import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];

export default function UnitTaskFormDialog({ open, onOpenChange, unitOptions = [], defaultUnit = "", onSaved }) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", due_date: "", priority: "Medium",
    unit_name: defaultUnit || unitOptions[0] || "",
  });
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (open) {
      setForm({
        title: "", description: "", due_date: "", priority: "Medium",
        unit_name: defaultUnit || unitOptions[0] || "",
      });
      setSelected(new Set());
    }
  }, [open, defaultUnit, unitOptions]);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["unit-members", tenantId, form.unit_name],
    enabled: !!tenantId && !!form.unit_name && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, user_id, church_unit")
        .eq("tenant_id", tenantId)
        .ilike("church_unit", `%${form.unit_name}%`)
        .order("first_name");
      if (error) throw error;
      // exact match within comma-separated list
      const needle = form.unit_name.trim().toLowerCase();
      return (data || []).filter((m) => (m.church_unit || "")
        .split(",").map((s) => s.trim().toLowerCase()).includes(needle));
    },
  });

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allSelected = members.length > 0 && selected.size === members.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(members.map((m) => m.id)));

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.unit_name) return toast.error("Select a unit");
    if (selected.size === 0) return toast.error("Select at least one member");
    if (!tenantId) return toast.error("No tenant context — reload the page");
    if (!user?.id) return toast.error("Not signed in");

    console.log("[unit-task] submit start", {
      tenantId, userId: user.id, unit: form.unit_name, count: selected.size,
    });

    setSaving(true);
    let createdTaskId = null;
    try {
      const payload = {
        tenant_id: tenantId,
        unit_name: form.unit_name,
        title: form.title.trim(),
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        priority: form.priority,
        status: "Open",
        created_by: user.id,
      };
      console.log("[unit-task] inserting task", payload);
      const { data: task, error: tErr } = await supabase
        .from("unit_tasks")
        .insert(payload)
        .select()
        .single();
      if (tErr) {
        console.error("[unit-task] task insert failed", tErr);
        if (/row-level security/i.test(tErr.message || "")) {
          throw new Error("You don't have permission to create a task for this unit.");
        }
        throw tErr;
      }
      console.log("[unit-task] task created", task);
      createdTaskId = task.id;

      const rows = members
        .filter((m) => selected.has(m.id))
        .map((m) => ({
          tenant_id: tenantId,
          task_id: task.id,
          member_id: m.id,
          user_id: m.user_id || null,
          status: "Pending",
        }));
      console.log("[unit-task] inserting assignments", rows.length);
      const { error: aErr } = await supabase.from("unit_task_assignments").insert(rows);
      if (aErr) {
        console.error("[unit-task] assignments failed", aErr);
        await supabase.from("unit_tasks").delete().eq("id", task.id).eq("tenant_id", tenantId);
        createdTaskId = null;
        throw aErr;
      }
      console.log("[unit-task] assignments inserted");

      try {
        supabase.functions.invoke("notify-unit-task-assignment", {
          body: { task_id: task.id, tenant_id: tenantId },
        }).catch((e) => console.warn("[unit-task] notify failed", e));
      } catch (e) { console.warn("[unit-task] notify threw", e); }

      try {
        logAudit("unit_task.created", "unit_task", task.id, {
          unit_name: form.unit_name, assignees: rows.length, title: task.title,
        }, tenantId);
      } catch (e) { console.warn("[unit-task] logAudit threw", e); }

      toast.success(`Task assigned to ${rows.length} member${rows.length === 1 ? "" : "s"}`);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("[unit-task] submit error", err);
      const msg = err?.message || err?.error_description || err?.details
        || (typeof err === "string" ? err : JSON.stringify(err));
      toast.error(msg || "Failed to create task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <TenantDialogHeader>New Unit Task</TenantDialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit_name} onValueChange={(v) => { update("unit_name", v); setSelected(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Prepare Sunday rehearsal" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input type="date" value={form.due_date} onChange={(e) => update("due_date", e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Assign to members ({selected.size} selected)</Label>
              {members.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                  {allSelected ? "Clear all" : "Select all"}
                </Button>
              )}
            </div>
            <div className="border border-border rounded-md">
              <ScrollArea className="h-56">
                {membersLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : members.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No members in this unit.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {members.map((m) => (
                      <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                        <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                        <span className="text-sm">{m.first_name} {m.last_name}</span>
                        {!m.user_id && <span className="text-xs text-muted-foreground ml-auto">no login</span>}
                      </label>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
