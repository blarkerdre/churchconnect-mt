import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Repeat } from "lucide-react";
import { useAppSetting } from "@/hooks/useAppSetting";
import { useChurchUnits } from "@/hooks/useChurchUnits";

const DEFAULT_CATEGORIES = ["Conference", "Special Service", "Revival", "Youth Event", "Women's Event", "Men's Event", "Children's Event", "Outreach", "Training", "Social", "Other"];
const STATUSES = ["Upcoming", "Ongoing", "Completed", "Cancelled"];
const EVENT_MODES = ["In Person", "Online", "Hybrid"];
const RECURRENCE_FREQUENCIES = ["Daily", "Weekly", "Biweekly", "Monthly"];
const REMINDER_OPTIONS = [
  { value: 1, label: "1 day before" },
  { value: 3, label: "3 days before" },
  { value: 7, label: "1 week before" },
];
const HOUR_REMINDER_OPTIONS = [
  { value: 1, label: "1 hour before" },
  { value: 2, label: "2 hours before" },
  { value: 6, label: "6 hours before" },
];

const empty = {
  title: "", description: "", category: "Special Service", audience: "All Members",
  date: "", end_date: "", start_time: "", end_time: "", location: "", address: "",
  registration_required: false, registration_deadline: "", status: "Upcoming", notes: "",
  event_mode: "In Person",
  is_recurring: false, recurrence_frequency: "Weekly", recurrence_end_date: "",
  reminder_days_before: [],
  reminder_hours_before: [],
};

export default function EventFormDialog({ open, onOpenChange, event, onSave, lockedCategory = null }) {
  const { data: CATEGORIES } = useAppSetting("event_categories", DEFAULT_CATEGORIES);
  const { data: churchUnitsData = [] } = useChurchUnits();
  const AUDIENCES = ["All Members", ...churchUnitsData.map(u => u.name), "WSF", "WSF Leaders", "Leaders Only"];
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const base = event
      ? {
          ...empty,
          ...event,
          reminder_days_before: event.reminder_days_before || [],
          reminder_hours_before: event.reminder_hours_before || [],
          is_recurring: event.is_recurring || false,
          recurrence_frequency: event.recurrence_frequency || "Weekly",
          recurrence_end_date: event.recurrence_end_date || "",
        }
      : empty;
    if (lockedCategory && !event) base.category = lockedCategory;
    setForm(base);
  }, [event, open, lockedCategory]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const toggleReminder = (day) => {
    setForm(p => {
      const current = p.reminder_days_before || [];
      return {
        ...p,
        reminder_days_before: current.includes(day)
          ? current.filter(d => d !== day)
          : [...current, day].sort((a, b) => a - b),
      };
    });
  };

  const toggleHourReminder = (hour) => {
    setForm(p => {
      const current = p.reminder_hours_before || [];
      return {
        ...p,
        reminder_hours_before: current.includes(hour)
          ? current.filter(h => h !== hour)
          : [...current, hour].sort((a, b) => a - b),
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...form });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Create New Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {/* Basic Info */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Event Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Annual Convention 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Category *</Label>
                {lockedCategory ? (
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {lockedCategory}
                    <span className="ml-2 text-xs text-muted-foreground">(locked to your unit)</span>
                  </div>
                ) : (
                  <Select value={form.category} onValueChange={v => set("category", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Event Mode</Label>
                <Select value={form.event_mode || "In Person"} onValueChange={v => set("event_mode", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <Select value={form.audience || "All Members"} onValueChange={v => set("audience", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AUDIENCES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3} placeholder="Brief description of the event..." />
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Date & Time</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date <span className="text-muted-foreground text-xs">(multi-day)</span></Label>
                <Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Location */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Venue Name</Label>
                <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Main Auditorium" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Full Address</Label>
                <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="Street, City, Postcode" />
              </div>
            </div>
          </div>

          {/* Recurrence */}
          {!event?.recurrence_parent_id && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recurrence</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Recurring Event</p>
                      <p className="text-xs text-muted-foreground">Create repeating occurrences automatically</p>
                    </div>
                  </div>
                  <Switch
                    checked={!!form.is_recurring}
                    onCheckedChange={v => set("is_recurring", v)}
                    disabled={!!event}
                  />
                </div>
                {form.is_recurring && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4">
                    <div className="space-y-1.5">
                      <Label>Frequency</Label>
                      <Select value={form.recurrence_frequency || "Weekly"} onValueChange={v => set("recurrence_frequency", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RECURRENCE_FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Repeat Until *</Label>
                      <Input
                        type="date"
                        value={form.recurrence_end_date}
                        onChange={e => set("recurrence_end_date", e.target.value)}
                        min={form.date || undefined}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reminders */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Reminders</h3>
            <div className="flex flex-wrap gap-4 p-3 rounded-xl bg-muted/50 border border-border">
              {REMINDER_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={(form.reminder_days_before || []).includes(opt.value)}
                    onCheckedChange={() => toggleReminder(opt.value)}
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Members will receive in-app notifications before the event</p>
          </div>

          {/* Registration */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Registration</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Registration Required</p>
                  <p className="text-xs text-muted-foreground">Enable to track registrations for this event</p>
                </div>
                <Switch checked={!!form.registration_required} onCheckedChange={v => set("registration_required", v)} />
              </div>
              {form.registration_required && (
                <div className="space-y-1.5 pl-4">
                  <Label>Registration Deadline</Label>
                  <Input type="date" value={form.registration_deadline} onChange={e => set("registration_deadline", e.target.value)} />
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} placeholder="Any additional notes..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.title || !form.date || (form.is_recurring && !form.recurrence_end_date)}
            className="bg-primary hover:bg-primary/90"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {event ? "Update Event" : form.is_recurring ? "Create Recurring Event" : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
