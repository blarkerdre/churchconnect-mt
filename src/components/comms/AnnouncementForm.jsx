import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";

const ALL_AUDIENCES = [
  "All Members", "Ushering", "Choir", "Media", "Children's Ministry", "Protocol",
  "Sanctuary Keepers", "Prayer & Intercession", "Evangelism", "Follow-up",
  "Youth Ministry", "Men's Ministry", "Women's Ministry", "Drama & Creative Arts",
  "Altar Ministers", "Pastoral Care", "Welfare", "CSR", "Transportation", "Leaders Only"
];

const empty = { title: "", body: "", audience: "All Members", pinned: false };

export default function AnnouncementForm({ open, onOpenChange, announcement, onSave, lockedAudience = null, availableAudiences = null }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const audiences = availableAudiences && availableAudiences.length > 0
    ? availableAudiences
    : ALL_AUDIENCES;

  useEffect(() => {
    const base = announcement ? { ...empty, ...announcement } : { ...empty };
    // If audience is locked (single-unit leader), force it
    if (lockedAudience && !announcement) base.audience = lockedAudience;
    // If available audiences provided and current audience not in list, default to first
    if (!announcement && !lockedAudience && availableAudiences?.length > 0 && !availableAudiences.includes(base.audience)) {
      base.audience = availableAudiences[0];
    }
    setForm(base);
  }, [announcement, open, lockedAudience, availableAudiences]);

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
        <TenantDialogHeader>{announcement ? "Edit Announcement" : "New Announcement"}</TenantDialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Sunday Service Reminder" />
          </div>
          <div className="space-y-1.5">
            <Label>Audience *</Label>
            {lockedAudience ? (
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                {lockedAudience}
                <span className="ml-2 text-xs text-muted-foreground">(locked to your unit)</span>
              </div>
            ) : (
              <Select value={form.audience} onValueChange={v => set("audience", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {audiences.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Message *</Label>
            <Textarea value={form.body} onChange={e => set("body", e.target.value)} rows={5} placeholder="Write your announcement here..." />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Pin Announcement</p>
              <p className="text-xs text-muted-foreground">Pinned announcements appear at the top</p>
            </div>
            <Switch checked={!!form.pinned} onCheckedChange={v => set("pinned", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.title || !form.body} className="bg-primary hover:bg-primary/90">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {announcement ? "Update" : "Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
