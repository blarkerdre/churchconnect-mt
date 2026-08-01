import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, Eye, RotateCcw, Save, Download } from "lucide-react";
import {
  DEFAULT_WOFBI_FEEDBACK_FIELDS,
  WOFBI_FEEDBACK_FIELD_TYPES,
  DEFAULT_SATISFACTION_SCALE,
  FEEDBACK_CONFIDENTIALITY_NOTE,
  mergeFeedbackDefaults,
} from "@/lib/wofbi-feedback-defaults";
import WoFBIDynamicForm from "./WoFBIDynamicForm";

function slug(s) {
  return String(s || "field").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || `field_${Date.now()}`;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export default function WoFBIFeedbackFormEditor() {
  const qc = useQueryClient();
  const { tenantId } = useTenantQuery();
  const [local, setLocal] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewValues, setPreviewValues] = useState({});
  const [viewing, setViewing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["wofbi-feedback-form", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wofbi_feedback_forms")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) setLocal(data);
    else if (data === null && tenantId) {
      setLocal({
        tenant_id: tenantId,
        enabled: false,
        title: "Bible School — Feedback Form",
        intro_text: "We would love to hear your feedback and testimony by completing this form.",
        fields: DEFAULT_WOFBI_FEEDBACK_FIELDS,
      });
    }
  }, [data, tenantId]);

  const { data: responses = [], isLoading: respLoading } = useQuery({
    queryKey: ["wofbi-feedback-responses", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wofbi_feedback_responses")
        .select("*, members(first_name, last_name, email)")
        .eq("tenant_id", tenantId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["wofbi-feedback-courses", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("exam_titles").select("id, name").eq("tenant_id", tenantId);
      return data || [];
    },
  });
  const courseName = (id) => courses.find((c) => c.id === id)?.name || "—";

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const row = {
        tenant_id: tenantId,
        enabled: payload.enabled,
        title: payload.title,
        intro_text: payload.intro_text,
        fields: payload.fields,
      };
      const { error } = await supabase.from("wofbi_feedback_forms").upsert(row, { onConflict: "tenant_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Feedback form saved" });
      qc.invalidateQueries({ queryKey: ["wofbi-feedback-form", tenantId] });
    },
    onError: (e) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteResponse = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("wofbi_feedback_responses").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Response deleted" });
      qc.invalidateQueries({ queryKey: ["wofbi-feedback-responses", tenantId] });
    },
    onError: (e) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const fields = local?.fields || [];

  const summary = useMemo(() => {
    const grids = fields.filter((f) => f.type === "rating_grid");
    const yesNo = fields.filter((f) => f.type === "yes_no");
    const gridStats = grids.map((g) => ({
      label: g.label,
      rows: (g.rows || []).map((r) => {
        const counts = {};
        responses.forEach((resp) => {
          const v = resp.answers?.[g.id]?.[r];
          if (v) counts[v] = (counts[v] || 0) + 1;
        });
        const scale = g.scale || DEFAULT_SATISFACTION_SCALE;
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const score = total
          ? Object.entries(counts).reduce((sum, [k, n]) => {
              const idx = scale.indexOf(k);
              return sum + (idx >= 0 ? (scale.length - idx) : 0) * n;
            }, 0) / total
          : 0;
        return { row: r, counts, total, avg: score ? score.toFixed(1) : "—", max: scale.length };
      }),
    }));
    const ynStats = yesNo.map((f) => ({
      label: f.label,
      yes: responses.filter((r) => r.answers?.[f.id] === "Yes").length,
      no: responses.filter((r) => r.answers?.[f.id] === "No").length,
    }));
    return { gridStats, ynStats };
  }, [fields, responses]);

  const exportCsv = () => {
    const flat = [];
    fields.forEach((f) => {
      if (f.type === "section_heading") return;
      if (f.type === "rating_grid") (f.rows || []).forEach((r) => flat.push({ key: `${f.id}::${r}`, label: `${f.label} — ${r}` }));
      else flat.push({ key: f.id, label: f.label });
    });
    const header = ["Student", "Email", "Course", "Submitted", ...flat.map((c) => c.label)];
    const lines = [header.map(csvEscape).join(",")];
    responses.forEach((r) => {
      const vals = flat.map((c) => {
        if (c.key.includes("::")) {
          const [fid, row] = c.key.split("::");
          return r.answers?.[fid]?.[row] || "";
        }
        const v = r.answers?.[c.key];
        return typeof v === "boolean" ? (v ? "Yes" : "No") : (v ?? "");
      });
      lines.push([
        `${r.members?.first_name || ""} ${r.members?.last_name || ""}`.trim(),
        r.members?.email || "",
        courseName(r.course_id),
        new Date(r.submitted_at).toLocaleString(),
        ...vals,
      ].map(csvEscape).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bible-school-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || !local) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading feedback form...</div>;
  }

  const move = (i, dir) => {
    const next = [...fields];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setLocal({ ...local, fields: next });
  };

  const remove = (i) => {
    if (!confirm("Remove this field?")) return;
    setLocal({ ...local, fields: fields.filter((_, idx) => idx !== i) });
  };

  const openAdd = () => {
    setEditingField({ id: "", type: "text", label: "", required: false, options: [], rows: [], scale: DEFAULT_SATISFACTION_SCALE });
    setEditingIndex(-1);
  };

  const openEdit = (i) => {
    setEditingField({
      ...fields[i],
      options: fields[i].options || [],
      rows: fields[i].rows || [],
      scale: fields[i].scale || DEFAULT_SATISFACTION_SCALE,
    });
    setEditingIndex(i);
  };

  const saveField = () => {
    if (!editingField.label.trim()) {
      toast({ title: "Label is required", variant: "destructive" });
      return;
    }
    const clean = {
      ...editingField,
      id: editingField.id?.trim() || slug(editingField.label),
      label: editingField.label.trim(),
    };
    if (!["select", "radio"].includes(clean.type)) delete clean.options;
    if (clean.type !== "rating_grid") {
      delete clean.rows;
      delete clean.scale;
    } else if (!clean.rows?.length || !clean.scale?.length) {
      toast({ title: "Rating grid needs rows and scale options", variant: "destructive" });
      return;
    }
    const next = [...fields];
    if (editingIndex >= 0) next[editingIndex] = clean;
    else next.push(clean);
    setLocal({ ...local, fields: next });
    setEditingField(null);
  };

  const resetToDefault = () => {
    if (!confirm("Reset to the default feedback form fields? Your current fields will be replaced.")) return;
    setLocal({ ...local, fields: DEFAULT_WOFBI_FEEDBACK_FIELDS });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Course Feedback Form</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30">
            <div>
              <Label className="text-sm font-medium">Collect course feedback</Label>
              <p className="text-xs text-muted-foreground">When on, students who have completed all exams for a course are asked to complete this feedback form.</p>
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
            <Button size="sm" className="gap-1.5 sm:ml-auto" onClick={() => saveMutation.mutate(local)} disabled={saveMutation.isPending}>
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
                  <div className="text-xs text-muted-foreground truncate">{f.type} · id: {f.id}</div>
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

      {/* Responses */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Responses <Badge variant="secondary" className="ml-1">{responses.length}</Badge></CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!responses.length}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {respLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading responses...</div>
          ) : responses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
          ) : (
            <>
              {(summary.gridStats.length > 0 || summary.ynStats.length > 0) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {summary.gridStats.map((g) => (
                    <div key={g.label} className="border rounded-md p-3">
                      <p className="text-xs font-semibold mb-2">{g.label}</p>
                      <div className="space-y-1">
                        {g.rows.map((r) => (
                          <div key={r.row} className="flex items-center justify-between text-xs gap-2">
                            <span className="text-muted-foreground truncate">{r.row}</span>
                            <span className="font-mono">{r.avg}/{r.max} ({r.total})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {summary.ynStats.length > 0 && (
                    <div className="border rounded-md p-3">
                      <p className="text-xs font-semibold mb-2">Yes / No</p>
                      <div className="space-y-1">
                        {summary.ynStats.map((y) => (
                          <div key={y.label} className="flex items-center justify-between text-xs gap-2">
                            <span className="text-muted-foreground truncate">{y.label}</span>
                            <span className="font-mono">{y.yes} yes · {y.no} no</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="border rounded-md divide-y">
                {responses.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 p-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {`${r.members?.first_name || ""} ${r.members?.last_name || ""}`.trim() || "Anonymous"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {courseName(r.course_id)} · {new Date(r.submitted_at).toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setViewing(r)}>View</Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Delete this response?") && deleteResponse.mutate(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Field editor */}
      <Dialog open={!!editingField} onOpenChange={(v) => !v && setEditingField(null)}>
        <DialogContent className="max-w-md w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingIndex >= 0 ? "Edit field" : "Add field"}</DialogTitle></DialogHeader>
          {editingField && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={editingField.type} onValueChange={(v) => setEditingField({ ...editingField, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WOFBI_FEEDBACK_FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
                  {editingField.type === "rating_grid" && (
                    <>
                      <div className="space-y-1">
                        <Label>Items to rate (one per line)</Label>
                        <Textarea value={(editingField.rows || []).join("\n")}
                          onChange={(e) => setEditingField({ ...editingField, rows: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                          rows={4} />
                      </div>
                      <div className="space-y-1">
                        <Label>Scale (one per line, best first)</Label>
                        <Textarea value={(editingField.scale || []).join("\n")}
                          onChange={(e) => setEditingField({ ...editingField, scale: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                          rows={5} />
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox id="fb-req" checked={!!editingField.required}
                      onCheckedChange={(v) => setEditingField({ ...editingField, required: !!v })} />
                    <Label htmlFor="fb-req" className="text-sm font-normal cursor-pointer">Required</Label>
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
        <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{local.title}</DialogTitle>
            {local.intro_text && <p className="text-sm text-muted-foreground">{local.intro_text}</p>}
          </DialogHeader>
          <WoFBIDynamicForm fields={fields} values={previewValues} onChange={(id, v) => setPreviewValues({ ...previewValues, [id]: v })} />
          <p className="text-xs text-muted-foreground pt-2 border-t">{FEEDBACK_CONFIDENTIALITY_NOTE}</p>
        </DialogContent>
      </Dialog>

      {/* Single response */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1rem)] sm:w-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {`${viewing?.members?.first_name || ""} ${viewing?.members?.last_name || ""}`.trim() || "Feedback response"}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {courseName(viewing.course_id)} · {new Date(viewing.submitted_at).toLocaleString()}
              </p>
              {fields.filter((f) => f.type !== "section_heading").map((f) => {
                const v = viewing.answers?.[f.id];
                if (f.type === "rating_grid") {
                  return (
                    <div key={f.id} className="space-y-1">
                      <p className="text-xs font-semibold">{f.label}</p>
                      {(f.rows || []).map((r) => (
                        <div key={r} className="flex justify-between text-sm gap-2">
                          <span className="text-muted-foreground">{r}</span>
                          <span>{v?.[r] || "—"}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return (
                  <div key={f.id}>
                    <p className="text-xs font-semibold">{f.label}</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {typeof v === "boolean" ? (v ? "Yes" : "No") : (v || "—")}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
