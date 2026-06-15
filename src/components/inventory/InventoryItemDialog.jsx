import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";

const CONDITIONS = ["good", "fair", "poor", "out_of_service"];

export default function InventoryItemDialog({ open, onOpenChange, item, categories = [], onSaved }) {
  const { tenantId, withTenant } = useTenantQuery();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category_id: "",
    location: "",
    serial_number: "",
    purchase_date: "",
    condition: "good",
    notes: "",
    requires_inspection: false,
    inspection_frequency_days: "",
  });
  const [checklist, setChecklist] = useState([]);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name || "",
        category_id: item.category_id || "",
        location: item.location || "",
        serial_number: item.serial_number || "",
        purchase_date: item.purchase_date || "",
        condition: item.condition || "good",
        notes: item.notes || "",
        requires_inspection: !!item.requires_inspection,
        inspection_frequency_days: item.inspection_frequency_days ?? "",
      });
      // Load checklist
      supabase
        .from("inventory_checklists")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("item_id", item.id)
        .order("position")
        .then(({ data }) => setChecklist(data || []));
    } else {
      setForm({
        name: "", category_id: "", location: "", serial_number: "",
        purchase_date: "", condition: "good", notes: "",
        requires_inspection: false, inspection_frequency_days: "",
      });
      setChecklist([]);
    }
  }, [open, item, tenantId]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addChecklistRow = () => setChecklist((c) => [...c, { _new: true, prompt: "", required: true, position: c.length }]);
  const updateChecklistRow = (i, k, v) => setChecklist((c) => c.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  const removeChecklistRow = (i) => setChecklist((c) => c.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category_id: form.category_id || null,
        location: form.location || null,
        serial_number: form.serial_number || null,
        purchase_date: form.purchase_date || null,
        condition: form.condition,
        notes: form.notes || null,
        requires_inspection: form.requires_inspection,
        inspection_frequency_days: form.inspection_frequency_days === "" ? null : parseInt(form.inspection_frequency_days, 10),
      };

      let itemId = item?.id;
      if (item) {
        const { error } = await supabase
          .from("inventory_items")
          .update(payload)
          .eq("id", item.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
        await logAudit("inventory.item_updated", "inventory_items", item.id, { name: payload.name }, tenantId);
      } else {
        const { data, error } = await supabase
          .from("inventory_items")
          .insert(withTenant({ ...payload, created_by: user?.id }))
          .select("id")
          .single();
        if (error) throw error;
        itemId = data.id;
        await logAudit("inventory.item_created", "inventory_items", itemId, { name: payload.name }, tenantId);
      }

      // Sync checklist when requires_inspection
      if (form.requires_inspection) {
        // Delete removed rows
        if (item) {
          const keptIds = checklist.filter((r) => r.id && !r._new).map((r) => r.id);
          let delQ = supabase.from("inventory_checklists").delete()
            .eq("item_id", itemId).eq("tenant_id", tenantId);
          if (keptIds.length) delQ = delQ.not("id", "in", `(${keptIds.join(",")})`);
          await delQ;
        }

        // Upserts
        const rowsToInsert = [];
        for (let i = 0; i < checklist.length; i++) {
          const row = checklist[i];
          const promptText = (row.prompt || "").trim();
          if (!promptText) continue;
          if (row.id && !row._new) {
            await supabase.from("inventory_checklists")
              .update({ prompt: promptText, required: !!row.required, position: i })
              .eq("id", row.id).eq("tenant_id", tenantId);
          } else {
            rowsToInsert.push(withTenant({
              item_id: itemId, prompt: promptText, required: !!row.required, position: i,
            }));
          }
        }
        if (rowsToInsert.length) {
          const { error: insErr } = await supabase.from("inventory_checklists").insert(rowsToInsert);
          if (insErr) throw insErr;
        }
      } else if (item) {
        // If inspection turned off, prune existing checklist
        await supabase.from("inventory_checklists").delete()
          .eq("item_id", itemId).eq("tenant_id", tenantId);
      }

      toast.success(item ? "Item updated" : "Item created");
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>
          <Package className="h-4 w-4" />
          {item ? "Edit Inventory Item" : "Add Inventory Item"}
        </TenantDialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => upd("name", e.target.value)} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category_id || "_none"} onValueChange={(v) => upd("category_id", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.default_frequency_days ? ` · every ${c.default_frequency_days}d` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={(v) => upd("condition", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => upd("location", e.target.value)} />
            </div>
            <div>
              <Label>Serial number</Label>
              <Input value={form.serial_number} onChange={(e) => upd("serial_number", e.target.value)} />
            </div>
            <div>
              <Label>Purchase date</Label>
              <Input type="date" value={form.purchase_date || ""} onChange={(e) => upd("purchase_date", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={2} />
            </div>
          </div>

          <div className="rounded-md border p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Requires Health & Safety inspection</div>
                <div className="text-xs text-muted-foreground">Enable to schedule recurring inspections and define a checklist.</div>
              </div>
              <Switch checked={form.requires_inspection} onCheckedChange={(v) => upd("requires_inspection", v)} />
            </div>

            {form.requires_inspection && (
              <>
                <div>
                  <Label>Inspection frequency (days)</Label>
                  <Input
                    type="number" min="1"
                    placeholder={(() => {
                      const cat = categories.find((c) => c.id === form.category_id);
                      return cat?.default_frequency_days ? `Inherits ${cat.default_frequency_days} from category` : "e.g. 30";
                    })()}
                    value={form.inspection_frequency_days}
                    onChange={(e) => upd("inspection_frequency_days", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Leave blank to use the category default.</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Checklist questions</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addChecklistRow}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add
                    </Button>
                  </div>
                  {checklist.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No checklist items yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {checklist.map((row, i) => (
                        <div key={row.id || `new-${i}`} className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Input
                            className="flex-1"
                            placeholder="e.g. Casing free from cracks and damage"
                            value={row.prompt || ""}
                            onChange={(e) => updateChecklistRow(i, "prompt", e.target.value)}
                          />
                          <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                            <Switch checked={!!row.required} onCheckedChange={(v) => updateChecklistRow(i, "required", v)} />
                            Required
                          </label>
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeChecklistRow(i)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
