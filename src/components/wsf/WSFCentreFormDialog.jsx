import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const empty = {
  name: "", host_name: "", leader_name: "", leader_email: "", address: "", postcode: "", city: "",
  phone: "", meeting_day: "", meeting_time: "", active: true, notes: ""
};

export default function WSFCentreFormDialog({ open, onOpenChange, centre, onSave }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(centre ? { ...empty, ...centre } : empty);
  }, [centre, open]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{centre ? "Edit WSF Centre" : "Add WSF Centre"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Centre Name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Cardiff North Cell" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>House Provider</Label>
              <Input value={form.host_name} onChange={e => set("host_name", e.target.value)} placeholder="Host's full name" />
            </div>
            <div className="space-y-1.5">
              <Label>WSF Leader Name</Label>
              <Input value={form.leader_name} onChange={e => set("leader_name", e.target.value)} placeholder="Leader's full name" />
            </div>
            <div className="space-y-1.5">
              <Label>WSF Leader Email</Label>
              <Input type="email" value={form.leader_email} onChange={e => set("leader_email", e.target.value)} placeholder="leader@email.com" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => set("address", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Cardiff" />
            </div>
            <div className="space-y-1.5">
              <Label>Postcode *</Label>
              <Input value={form.postcode} onChange={e => set("postcode", e.target.value)} placeholder="CF10 1AB" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Meeting Day</Label>
              <Select value={form.meeting_day} onValueChange={v => set("meeting_day", v)}>
                <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Meeting Time</Label>
              <Input type="time" value={form.meeting_time} onChange={e => set("meeting_time", e.target.value)} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
              <Label>Active Centre</Label>
              <Switch checked={!!form.active} onCheckedChange={v => set("active", v)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name || !form.postcode} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {centre ? "Update" : "Add Centre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}