import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Check, X, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";

const RESULTS = [
  { value: "pass", label: "Pass", icon: Check, color: "bg-chart-3 text-white" },
  { value: "fail", label: "Fail", icon: X, color: "bg-destructive text-white" },
  { value: "na", label: "N/A", icon: Minus, color: "bg-muted text-muted-foreground" },
];

export default function InspectionDialog({ open, onOpenChange, item, onCompleted }) {
  const { tenantId, withTenant } = useTenantQuery();
  const { user, profile } = useAuth();
  const [checklist, setChecklist] = useState([]);
  const [responses, setResponses] = useState({});
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setNotes("");
    setSignature(profile?.full_name || "");
    setResponses({});
    supabase
      .from("inventory_checklists")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("item_id", item.id)
      .order("position")
      .then(({ data }) => setChecklist(data || []));
  }, [open, item, tenantId, profile?.full_name]);

  const setResp = (id, k, v) => setResponses((r) => ({ ...r, [id]: { ...r[id], [k]: v } }));

  const handleSubmit = async () => {
    // Validate required answers
    const missing = checklist.filter((c) => c.required && !responses[c.id]?.result);
    if (missing.length) {
      toast.error(`Please answer all required questions (${missing.length} remaining).`);
      return;
    }
    const anyFail = checklist.some((c) => responses[c.id]?.result === "fail");
    const overall = anyFail ? "fail" : (Object.values(responses).some((r) => r.result === "na") && !checklist.some((c) => responses[c.id]?.result === "pass") ? "needs_attention" : "pass");

    setSaving(true);
    try {
      const { data: insp, error: e1 } = await supabase
        .from("inventory_inspections")
        .insert(withTenant({
          item_id: item.id,
          inspected_by: user?.id,
          overall_result: overall,
          notes: notes || null,
          signature_name: signature || null,
        }))
        .select("id")
        .single();
      if (e1) throw e1;

      if (checklist.length) {
        const rows = checklist.map((c, i) => withTenant({
          inspection_id: insp.id,
          checklist_item_id: c.id,
          prompt_snapshot: c.prompt,
          result: responses[c.id]?.result || "na",
          comment: responses[c.id]?.comment || null,
          position: i,
        }));
        const { error: e2 } = await supabase.from("inventory_inspection_responses").insert(rows);
        if (e2) throw e2;
      }

      await logAudit("inventory.inspection_completed", "inventory_inspections", insp.id, { item_id: item.id, item: item.name, result: overall }, tenantId);
      toast.success(`Inspection saved (${overall})`);
      onCompleted?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e.message || "Failed to save inspection");
    } finally {
      setSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>
          <ShieldCheck className="h-4 w-4" />
          Health & Safety Inspection
        </TenantDialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 bg-muted/30">
            <div className="font-semibold">{item.name}</div>
            <div className="text-xs text-muted-foreground">
              {item.location && <>Location: {item.location} · </>}
              {item.serial_number && <>S/N: {item.serial_number}</>}
            </div>
          </div>

          {checklist.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checklist questions defined for this item. Add some from Edit item.</p>
          ) : (
            <div className="space-y-3">
              {checklist.map((c, idx) => (
                <div key={c.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                      {c.prompt}
                      {c.required && <Badge variant="outline" className="ml-2 text-[10px]">Required</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {RESULTS.map((r) => {
                      const Icon = r.icon;
                      const active = responses[c.id]?.result === r.value;
                      return (
                        <Button
                          key={r.value}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          className={active ? r.color : ""}
                          onClick={() => setResp(c.id, "result", r.value)}
                        >
                          <Icon className="h-3.5 w-3.5 mr-1" /> {r.label}
                        </Button>
                      );
                    })}
                  </div>
                  <Input
                    placeholder="Comment (optional)"
                    value={responses[c.id]?.comment || ""}
                    onChange={(e) => setResp(c.id, "comment", e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <Label>Overall notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label>Inspector signature (name)</Label>
            <Input value={signature} onChange={(e) => setSignature(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : "Submit Inspection"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
