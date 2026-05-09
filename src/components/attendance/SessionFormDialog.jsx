import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Users } from "lucide-react";
import { useChurchUnits } from "@/hooks/useChurchUnits";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const SESSION_TYPES = [
  "Sunday Service",
  "Midweek Service",
  "Special Service",
  "Bible School",
  "Prayer Meeting",
  "Special Event",
  "Unit Meeting",
  "Home Cell Meeting",
  "Other",
];

// Types that are always tenant-wide (no unit/centre scoping)
const ALL_MEMBERS_TYPES = new Set([
  "Sunday Service",
  "Midweek Service",
  "Special Service",
  "Bible School",
  "Prayer Meeting",
  "Special Event",
  "Other",
]);

const empty = {
  title: "", session_type: "Sunday Service", unit: "", date: new Date().toISOString().split("T")[0], notes: "", status: "Open"
};

export default function SessionFormDialog({ open, onOpenChange, onSave, isAdmin = true, myUnits = [] }) {
  const { data: churchUnits = [] } = useChurchUnits();
  const { tenantId, scopeQuery } = useTenantQuery();
  const allUnitNames = churchUnits.map(u => u.name);
  const isUnitLeader = !isAdmin;
  const singleUnit = myUnits.length === 1 ? myUnits[0] : "";

  const { data: centres = [] } = useQuery({
    queryKey: ["wsf-centres-for-session", tenantId],
    enabled: open && !!tenantId,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("wsf_centres").select("id, name").order("name")
      );
      if (error) throw error;
      return data || [];
    },
  });

  const getEmpty = () => ({
    ...empty,
    session_type: isUnitLeader ? "Unit Meeting" : "Sunday Service",
    unit: singleUnit,
    date: new Date().toISOString().split("T")[0],
  });

  const [form, setForm] = useState(getEmpty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(getEmpty());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // When the type changes, clear `unit` for all-members types so the audience is unambiguous
  const handleTypeChange = (v) => {
    setForm(p => ({
      ...p,
      session_type: v,
      unit: ALL_MEMBERS_TYPES.has(v) ? "" : p.unit,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  const unitOptions = isAdmin ? allUnitNames : myUnits;
  const isUnitMeeting = form.session_type === "Unit Meeting";
  const isHomeCellMeeting = form.session_type === "Home Cell Meeting";
  const isScoped = isUnitMeeting || isHomeCellMeeting;

  const audienceText = useMemo(() => {
    if (isUnitMeeting) {
      return form.unit
        ? `Visible to members of ${form.unit} unit`
        : "Pick a unit — only members of that unit will see this meeting";
    }
    if (isHomeCellMeeting) {
      return form.unit
        ? `Visible to members of ${form.unit} Home Cell`
        : "Pick a Home Cell — only members of that centre will see this meeting";
    }
    return "Visible to all members in this church";
  }, [isUnitMeeting, isHomeCellMeeting, form.unit]);

  const canSave = !!form.title && !!form.date && (!isScoped || !!form.unit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>New Attendance Meeting</TenantDialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Meeting Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Sunday Service - 9 Mar" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              {isUnitLeader ? (
                <div className="h-9 flex items-center px-3 rounded-md border border-input bg-slate-50 text-sm text-slate-600">Unit Meeting</div>
              ) : (
                <Select value={form.session_type} onValueChange={handleTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SESSION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
          </div>

          {isUnitMeeting && (
            <div className="space-y-1.5">
              <Label>Church Unit {isUnitLeader && <span className="text-xs text-slate-400">(your unit only)</span>}</Label>
              {isUnitLeader && singleUnit ? (
                <div className="h-9 flex items-center px-3 rounded-md border border-input bg-slate-50 text-sm text-slate-600">{singleUnit}</div>
              ) : (
                <Select value={form.unit} onValueChange={v => set("unit", v)}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>{unitOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          )}

          {isHomeCellMeeting && (
            <div className="space-y-1.5">
              <Label>Home Cell Centre</Label>
              {centres.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No Home Cell centres yet. Add one in Settings → Home Cell Centres.
                </p>
              ) : (
                <Select value={form.unit} onValueChange={v => set("unit", v)}>
                  <SelectTrigger><SelectValue placeholder="Select Home Cell" /></SelectTrigger>
                  <SelectContent>
                    {centres.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
            <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground">{audienceText}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !canSave} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
