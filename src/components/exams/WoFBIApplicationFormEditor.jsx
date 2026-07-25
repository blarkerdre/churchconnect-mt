import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Eye, RotateCcw, Save } from "lucide-react";
import { DEFAULT_WOFBI_FIELDS, WOFBI_FIELD_TYPES } from "@/lib/wofbi-form-defaults";
import WoFBIDynamicForm from "./WoFBIDynamicForm";

function slug(s) {
  return String(s || "field").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || `field_${Date.now()}`;
}

export default function WoFBIApplicationFormEditor() {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const [local, setLocal] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewValues, setPreviewValues] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["wofbi-application-form", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wofbi_application_forms")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setLocal(data);
    } else if (data === null && tenantId) {
      setLocal({
        tenant_id: tenantId,
        enabled: false,
        title: "Bible School — Application Form",
        intro_text: "Please complete this application form to register for our Bible School programme.",
        fields: DEFAULT_WOFBI_FIELDS,
      });
    }
  }, [data, tenantId]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const row = {
        tenant_id: tenantId,
        enabled: payload.enabled,
        title: payload.title,
        intro_text: payload.intro_text,
        fields: payload.fields,
      };
      const { error } = await supabase
        .from("wofbi_application_forms")
        .upsert(row, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Application form saved" });
      qc.invalidateQueries({ queryKey: ["wofbi-application-form", tenantId] });
    },
    onError: (e) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading || !local) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading application form...</div>;
  }

  const fields = local.fields || [];

  const move = (i, dir) => {
    const next = [...fields];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setLocal({ ...local, fields: next });
  };

  const remove = (i) => {
    if (!confirm("Remove this field?")) return;
    const next = fields.filter((_, idx) => idx !== i);
    setLocal({ ...local, fields: next });
  };

  const openAdd = () => {
    setEditingField({ id: "", type: "text", label: "", required: false, options: [] });
    setEditingIndex(-1);
  };

  const openEdit = (i) => {
    setEditingField({ ...fields[i], options: fields[i].options || [] });
    setEditingIndex(i);
  };

  const saveField = () => {
    if (!editingField.label.trim() && editingField.type !== "section_heading") {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    const clean = {
      ...editingField,
      id: editingField.id?.trim() || slug(editingField.label),
      label: editingField.label.trim(),
    };
    if (!["select", "radio"].includes(clean.type)) delete clean.options;
    const next = [...fields];
    if (editingIndex >= 0) next[editingIndex] = clean;
    else next.push(clean);
    setLocal({ ...local, fields: next });
    setEditingField(null);
  };

  const resetToDefault = () => {
    if (!confirm("Reset form to the default WOFBI fields? Your current fields will be replaced.")) return;
    setLocal({ ...local, fields: DEFAULT_WOFBI_FIELDS });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Form Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Use detailed application form</Label>
              <p className="text-xs text-muted-foreground">When on, the public registration link shows the full application form below instead of the short form.</p>
            </div>
            <Switch checked={!!local.enabled} onCheckedChange={(v) => setLocal({ ...local, enabled: v })} />
          </div>

          <div className="space-y-1">
            <Label>Title</Label>
            <Input value={local.title || ""} onChange={(e) => setLocal({ ...local, title: e.target.value })} maxLength={200} />
          </div>
          <div className="space-y-1">
            <Label>Intro text</Label>
            <Textarea value={local.intro_text || ""} onChange={(e) => setLocal({ ...local, intro_text: e.target.value })} maxLength={1000} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button size="sm" onClick={openAdd} className="gap-1.5"><Plus className="h-4 w-4" /> Add field</Button>
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)} className="gap-1.5"><Eye className="h-4 w-4" /> Preview</Button>
            <Button size="sm" variant="outline" onClick={resetToDefault} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Reset to default</Button>
            <Button size="sm" className="gap-1.5 ml-auto" onClick={() => saveMutation.mutate(local)} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
            </Button>
          </div>

          <div className="border rounded-md divide-y">
            {fields.length === 0 && <p className="text-sm text-muted-foreground p-4">No fields yet. Click "Add field" to create one.</p>}
            {fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {f.type === "section_heading" ? `§ ${f.label}` : f.label}
                    {f.required && <span className="text-destructive ml-1">*</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{f.type} · id: {f.id}</div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === fields.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(i)}>Edit</Button>
                <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Field editor dialog */}
      <Dialog open={!!editingField} onOpenChange={(v) => !v && setEditingField(null)}>
        <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-auto">
          <DialogHeader>
            <DialogTitle>{editingIndex >= 0 ? "Edit field" : "Add field"}</DialogTitle>
          </DialogHeader>
          {editingField && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={editingField.type} onValueChange={(v) => setEditingField({ ...editingField, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WOFBI_FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Label</Label>
                <Input value={editingField.label} onChange={(e) => setEditingField({ ...editingField, label: e.target.value })} maxLength={200} />
              </div>
              {editingField.type !== "section_heading" && (
                <>
                  <div className="space-y-1">
                    <Label>Field ID (optional)</Label>
                    <Input value={editingField.id} onChange={(e) => setEditingField({ ...editingField, id: e.target.value })}
                      placeholder="auto-generated from label" maxLength={40} />
                  </div>
                  <div className="space-y-1">
                    <Label>Help text</Label>
                    <Textarea value={editingField.help_text || ""} onChange={(e) => setEditingField({ ...editingField, help_text: e.target.value })} maxLength={500} />
                  </div>
                  {(editingField.type === "select" || editingField.type === "radio") && (
                    <div className="space-y-1">
                      <Label>Options (one per line)</Label>
                      <Textarea value={(editingField.options || []).join("\n")}
                        onChange={(e) => setEditingField({ ...editingField, options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                        rows={4} />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox id="req" checked={!!editingField.required}
                      onCheckedChange={(v) => setEditingField({ ...editingField, required: !!v })} />
                    <Label htmlFor="req" className="text-sm font-normal cursor-pointer">Required</Label>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>Cancel</Button>
            <Button onClick={saveField}>Save field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-auto">
          <DialogHeader>
            <DialogTitle>{local.title}</DialogTitle>
            {local.intro_text && <p className="text-sm text-muted-foreground">{local.intro_text}</p>}
          </DialogHeader>
          <WoFBIDynamicForm fields={fields} values={previewValues} onChange={(id, v) => setPreviewValues({ ...previewValues, [id]: v })} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
