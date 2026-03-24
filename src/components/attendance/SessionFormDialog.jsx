import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const SESSION_TYPES = ["Sunday Service", "Midweek Service", "Unit Meeting", "Special Event", "Prayer Meeting"];
const UNITS = [
  "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts",
  "Altar Ministers", "Pastoral Care", "Welfare", "CSR", "Transportation"
];

const empty = {
  title: "", session_type: "Sunday Service", unit: "", date: new Date().toISOString().split("T")[0], notes: "", status: "Open"
};

export default function SessionFormDialog({ open, onOpenChange, onSave, isAdmin = true, myUnits = [] }) {
  const isUnitLeader = !isAdmin;
  const singleUnit = myUnits.length === 1 ? myUnits[0] : "";

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

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  const unitOptions = isAdmin ? UNITS : myUnits;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New Attendance Meeting</DialogTitle></DialogHeader>
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
                <Select value={form.session_type} onValueChange={v => set("session_type", v)}>
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
          {(isUnitLeader || form.session_type === "Unit Meeting") && (
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
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title || !form.date} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}