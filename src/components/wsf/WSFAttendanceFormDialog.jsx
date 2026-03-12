import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const empty = {
  date: "", total_attendees: 0, male: 0, female: 0,
  teens: 0, children: 0, testimonies: 0, notes: ""
};

export default function WSFAttendanceFormDialog({ open, onOpenChange, centre, attendance, onSave, allCentres = [] }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [selectedCentreId, setSelectedCentreId] = useState("");

  useEffect(() => {
    setForm(attendance ? { ...empty, ...attendance } : { ...empty, date: new Date().toISOString().split("T")[0] });
    setSelectedCentreId(centre?.id || "");
  }, [attendance, centre, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const num = (k, v) => set(k, parseInt(v) || 0);

  const handleSave = async () => {
    const activeCentre = centre || allCentres.find(c => c.id === selectedCentreId);
    if (!activeCentre) return;
    setSaving(true);
    await onSave({ ...form, centre_id: activeCentre.id, centre_name: activeCentre.name });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{attendance ? "Edit Attendance" : "Record Attendance"}</DialogTitle>
          {centre && <p className="text-sm text-slate-500">{centre.name}</p>}
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!centre && allCentres.length > 0 && (
            <div className="space-y-1.5">
              <Label>WSF Centre *</Label>
              <Select value={selectedCentreId} onValueChange={setSelectedCentreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a centre..." />
                </SelectTrigger>
                <SelectContent>
                  {allCentres.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Meeting Date *</Label>
            <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Total Attendees</Label>
              <Input type="number" min={0} value={form.total_attendees} onChange={e => num("total_attendees", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Male</Label>
              <Input type="number" min={0} value={form.male} onChange={e => num("male", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Female</Label>
              <Input type="number" min={0} value={form.female} onChange={e => num("female", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Teens</Label>
              <Input type="number" min={0} value={form.teens} onChange={e => num("teens", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Children</Label>
              <Input type="number" min={0} value={form.children} onChange={e => num("children", e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Number of Testimonies</Label>
              <Input type="number" min={0} value={form.testimonies} onChange={e => num("testimonies", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Meeting highlights..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.date || (!centre && !selectedCentreId)} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {attendance ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}