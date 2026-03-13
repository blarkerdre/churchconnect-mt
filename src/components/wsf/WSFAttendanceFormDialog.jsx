import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const empty = {
  date: "", male: 0, female: 0, children: 0,
  first_timers: 0, testimonies: 0, notes: ""
};

export default function WSFAttendanceFormDialog({ open, onOpenChange, centre, report, onSave, allCentres = [] }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [selectedCentreId, setSelectedCentreId] = useState("");

  useEffect(() => {
    if (report) {
      setForm({
        date: report.meeting_date || "",
        male: report.male || 0,
        female: report.female || 0,
        children: report.children || 0,
        first_timers: report.first_timers || 0,
        testimonies: report.testimonies || 0,
        notes: report.notes || "",
      });
    } else {
      setForm({ ...empty, date: new Date().toISOString().split("T")[0] });
    }
    setSelectedCentreId(centre?.id || "");
  }, [report, centre, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const num = (k, v) => set(k, Math.max(0, parseInt(v) || 0));

  const adults = form.male + form.female;
  const totalAttendees = adults + form.children;

  const handleSave = async () => {
    const activeCentreId = centre?.id || selectedCentreId;
    if (!activeCentreId || !form.date) return;
    setSaving(true);
    await onSave({
      centre_id: activeCentreId,
      meeting_date: form.date,
      male: form.male,
      female: form.female,
      children: form.children,
      first_timers: form.first_timers,
      testimonies: form.testimonies,
      notes: form.notes || null,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{report ? "Edit Attendance Report" : "Record Attendance"}</DialogTitle>
          {centre && <p className="text-sm text-muted-foreground">{centre.name}</p>}
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
            <div className="space-y-1.5">
              <Label>Male</Label>
              <Input type="number" min={0} value={form.male} onChange={e => num("male", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Female</Label>
              <Input type="number" min={0} value={form.female} onChange={e => num("female", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Children</Label>
              <Input type="number" min={0} value={form.children} onChange={e => num("children", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>First Timers</Label>
              <Input type="number" min={0} value={form.first_timers} onChange={e => num("first_timers", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Testimonies</Label>
              <Input type="number" min={0} value={form.testimonies} onChange={e => num("testimonies", e.target.value)} />
            </div>
          </div>
          {/* Calculated totals */}
          <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Adults</p>
              <p className="text-lg font-bold text-foreground">{adults}</p>
              <p className="text-xs text-muted-foreground">(Male + Female)</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Attendees</p>
              <p className="text-lg font-bold text-primary">{totalAttendees}</p>
              <p className="text-xs text-muted-foreground">(Adults + Children)</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Meeting highlights..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.date || (!centre && !selectedCentreId)}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {report ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
