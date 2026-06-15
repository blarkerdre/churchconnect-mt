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
import { Loader2, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

const FALLBACK_SERVICE_TYPES = ["Sunday Service", "Midweek Service", "Special Program", "Thanksgiving Service", "Other"];

export default function ServiceRosterDialog({ open, onOpenChange, unitOptions = [], defaultUnit = "", onSaved }) {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    unit_name: defaultUnit || unitOptions[0] || "",
    service_type: "",
    service_date: "",
    title: "",
  });
  const [selected, setSelected] = useState(new Set()); // member ids
  const [tasksByMember, setTasksByMember] = useState({}); // memberId -> { title, description, due_date }

  useEffect(() => {
    if (open) {
      setForm({
        unit_name: defaultUnit || unitOptions[0] || "",
        service_type: "",
        service_date: new Date().toISOString().slice(0, 10),
        title: "",
      });
      setSelected(new Set());
      setTasksByMember({});
    }
  }, [open, defaultUnit, unitOptions]);

  // Load service types from settings
  const { data: serviceTypes = FALLBACK_SERVICE_TYPES } = useQuery({
    queryKey: ["service-types-setting", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("tenant_id", tenantId)
        .eq("key", "service_types")
        .maybeSingle();
      const arr = Array.isArray(data?.value) ? data.value : null;
      return arr && arr.length ? arr : FALLBACK_SERVICE_TYPES;
    },
  });

  // Set default service type after types load
  useEffect(() => {
    if (open && !form.service_type && serviceTypes?.length) {
      setForm((p) => ({ ...p, service_type: serviceTypes[0] }));
    }
  }, [open, serviceTypes, form.service_type]);

  // Members for selected unit
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["roster-unit-members", tenantId, form.unit_name],
    enabled: !!tenantId && !!form.unit_name && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, first_name, last_name, user_id, church_unit")
        .eq("tenant_id", tenantId)
        .ilike("church_unit", `%${form.unit_name}%`)
        .order("first_name");
      if (error) throw error;
      const needle = form.unit_name.trim().toLowerCase();
      return (data || []).filter((m) =>
        (m.church_unit || "").split(",").map((s) => s.trim().toLowerCase()).includes(needle)
      );
    },
  });

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setTasksByMember((tm) => { const c = { ...tm }; delete c[id]; return c; });
      } else {
        next.add(id);
        setTasksByMember((tm) => ({ ...tm, [id]: { title: "", description: "", due_date: "" } }));
      }
      return next;
    });
  };
  const allSelected = members.length > 0 && selected.size === members.length;
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
      setTasksByMember({});
    } else {
      const next = new Set(members.map((m) => m.id));
      setSelected(next);
      const tm = {};
      members.forEach((m) => { tm[m.id] = tasksByMember[m.id] || { title: "", description: "", due_date: "" }; });
      setTasksByMember(tm);
    }
  };

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const updateTask = (mid, key, val) =>
    setTasksByMember((tm) => ({ ...tm, [mid]: { ...(tm[mid] || {}), [key]: val } }));

  const selectedMembers = useMemo(
    () => members.filter((m) => selected.has(m.id)),
    [members, selected]
  );

  const applyTitleToAll = () => {
    const first = selectedMembers[0];
    const tpl = first ? tasksByMember[first.id]?.title?.trim() : "";
    if (!tpl) return toast.info("Set the first member's task title to copy.");
    setTasksByMember((tm) => {
      const next = { ...tm };
      selectedMembers.forEach((m) => { next[m.id] = { ...(next[m.id] || {}), title: tpl }; });
      return next;
    });
  };

  const submit = async () => {
    if (!tenantId) return toast.error("No tenant context — reload the page");
    if (!user?.id) return toast.error("Not signed in");
    if (!form.unit_name) return toast.error("Select a unit");
    if (!form.service_type) return toast.error("Select a service type");
    if (!form.service_date) return toast.error("Pick a service date");
    if (selected.size === 0) return toast.error("Select at least one member");

    const assignments = [];
    for (const m of selectedMembers) {
      const t = tasksByMember[m.id] || {};
      if (!t.title?.trim()) {
        return toast.error(`Add a task title for ${m.first_name} ${m.last_name}`);
      }
      assignments.push({
        member_id: m.id,
        title: t.title.trim(),
        description: t.description?.trim() || null,
        due_date: t.due_date || null,
      });
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-service-roster", {
        body: {
          tenant_id: tenantId,
          unit_name: form.unit_name,
          service_type: form.service_type,
          service_date: form.service_date,
          title: form.title.trim() || null,
          assignments,
        },
      });
      if (error) {
        let serverMsg = "";
        try {
          const ctx = error?.context;
          if (ctx?.json) serverMsg = (await ctx.json())?.error || "";
          else if (ctx?.text) serverMsg = await ctx.text();
        } catch { /* noop */ }
        throw new Error(serverMsg || error.message || "Failed to create roster");
      }
      if (data?.error) throw new Error(data.error);

      try {
        logAudit("unit_task_roster.created", "unit_task_group", data?.group_id, {
          unit_name: form.unit_name,
          service_type: form.service_type,
          service_date: form.service_date,
          members: assignments.length,
        }, tenantId);
      } catch { /* noop */ }

      toast.success(`Roster created for ${assignments.length} member${assignments.length === 1 ? "" : "s"}`);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error("[service-roster] submit error", err);
      toast.error(err?.message || "Failed to create roster");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <TenantDialogHeader>New Service Roster</TenantDialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Service type</Label>
              <Select value={form.service_type} onValueChange={(v) => update("service_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Service date</Label>
              <Input type="date" value={form.service_date} onChange={(e) => update("service_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select
                value={form.unit_name}
                onValueChange={(v) => { update("unit_name", v); setSelected(new Set()); setTasksByMember({}); }}
              >
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Roster title (optional)</Label>
            <Input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Sunday AM duties" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Pick members ({selected.size} selected)</Label>
              {members.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                  {allSelected ? "Clear all" : "Select all"}
                </Button>
              )}
            </div>
            <div className="border border-border rounded-md">
              <ScrollArea className="h-40">
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

          {selectedMembers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Assign tasks (one per member)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={applyTitleToAll}>
                  Copy first title to all
                </Button>
              </div>
              <div className="border border-border rounded-md divide-y divide-border">
                {selectedMembers.map((m) => {
                  const t = tasksByMember[m.id] || {};
                  return (
                    <div key={m.id} className="p-3 space-y-2">
                      <div className="text-sm font-medium">{m.first_name} {m.last_name}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input
                          className="sm:col-span-2"
                          placeholder="Task title (required)"
                          value={t.title || ""}
                          onChange={(e) => updateTask(m.id, "title", e.target.value)}
                        />
                        <Input
                          type="date"
                          value={t.due_date || ""}
                          onChange={(e) => updateTask(m.id, "due_date", e.target.value)}
                        />
                      </div>
                      <Textarea
                        rows={2}
                        placeholder="Notes (optional)"
                        value={t.description || ""}
                        onChange={(e) => updateTask(m.id, "description", e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Every selected member will receive one notification listing the full roster (who got what).
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Roster
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
