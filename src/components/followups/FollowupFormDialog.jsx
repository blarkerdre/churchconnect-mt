import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const CATEGORIES = ["New Convert", "First Timer", "Pastoral Care", "Membership Inquiry", "Bereavement", "Hospital Visit", "General"];
const TYPES = ["Phone Call", "Home Visit", "Hospital Visit", "Prayer Session", "Counselling", "New Convert Follow-up", "First Timer Follow-up", "General Check-in", "Bereavement", "Other"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"];

const emptyForm = {
  person_name: "", member_id: "", person_type: "Member",
  category: "General", type: "Phone Call",
  assigned_to: "", assigned_to_id: "",
  status: "Pending", priority: "Medium",
  scheduled_date: "", due_date: "", completed_date: "",
  outcome: "", notes: "", progress_log: [],
};

export default function FollowupFormDialog({ open, onOpenChange, followup, onSave, members = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(followup ? { ...emptyForm, ...followup, progress_log: followup.progress_log || [] } : emptyForm);
  }, [followup, open]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const people = members.map((m) => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`,
    type: m.membership_status || "Member",
  }));

  const assignees = members
    .filter((m) => (m.church_units || []).includes("Follow-up"))
    .map((m) => ({ id: m.id, name: `${m.first_name} ${m.last_name}` }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>{followup ? "Edit Follow-up" : "Create Follow-up"}</TenantDialogHeader>
        <div className="space-y-4 py-4">

          {/* Person */}
          <div className="space-y-1.5">
            <Label>Person *</Label>
            {people.length > 0 ? (
              <Select
                value={form.member_id}
                onValueChange={(id) => {
                  const p = people.find((x) => x.id === id);
                  if (p) { set("member_id", p.id); set("person_name", p.name); set("person_type", p.type); }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} <span className="text-slate-400 ml-1">({p.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.person_name} onChange={(e) => set("person_name", e.target.value)} placeholder="Full name" />
            )}
          </div>

          {/* Category + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contact Type *</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned To — pick from members list */}
          <div className="space-y-1.5">
            <Label>Assigned To *</Label>
            {assignees.length > 0 ? (
              <Select
                value={form.assigned_to_id || "__manual__"}
                onValueChange={(id) => {
                  if (id === "__manual__") return;
                  const m = assignees.find(a => a.id === id);
                  if (m) { set("assigned_to", m.name); set("assigned_to_id", m.id); }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                <SelectContent>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Input
              value={form.assigned_to}
              onChange={(e) => { set("assigned_to", e.target.value); set("assigned_to_id", ""); }}
              placeholder="Or type a name manually"
              className={assignees.length > 0 ? "mt-1" : ""}
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Scheduled Date</Label>
              <Input type="date" value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>
          </div>

          {form.status === "Completed" && (
            <div className="space-y-1.5">
              <Label>Completed Date</Label>
              <Input type="date" value={form.completed_date} onChange={(e) => set("completed_date", e.target.value)} />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Outcome / Result</Label>
            <Textarea value={form.outcome} onChange={(e) => set("outcome", e.target.value)} rows={2} placeholder="What happened during the follow-up?" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Additional internal notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.person_name || !form.assigned_to} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {followup ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}