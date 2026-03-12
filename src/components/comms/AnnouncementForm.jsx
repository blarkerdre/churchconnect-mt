import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

const AUDIENCES = [
  "All Members", "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts", "Leaders Only"
];

const empty = { title: "", body: "", audience: "All Members", pinned: false };

export default function AnnouncementForm({ open, onOpenChange, announcement, onSave, lockedAudience = null }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const base = announcement ? { ...empty, ...announcement } : empty;
    // If audience is locked (unit leader), force it
    if (lockedAudience && !announcement) base.audience = lockedAudience;
    setForm(base);
  }, [announcement, open, lockedAudience]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{announcement ? "Edit Announcement" : "New Announcement"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Sunday Service Reminder" />
          </div>
          <div className="space-y-1.5">
            <Label>Audience *</Label>
            {lockedAudience ? (
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {lockedAudience}
                <span className="ml-2 text-xs text-slate-400">(locked to your unit)</span>
              </div>
            ) : (
              <Select value={form.audience} onValueChange={v => set("audience", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUDIENCES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Message *</Label>
            <Textarea value={form.body} onChange={e => set("body", e.target.value)} rows={5} placeholder="Write your announcement here..." />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700">Pin Announcement</p>
              <p className="text-xs text-slate-400">Pinned announcements appear at the top</p>
            </div>
            <Switch checked={!!form.pinned} onCheckedChange={v => set("pinned", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title || !form.body} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {announcement ? "Update" : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}