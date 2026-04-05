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
import { useAppSetting } from "@/hooks/useAppSetting";

const DEFAULT_CATEGORIES = [
  "Prayer Request", "Counselling Session", "Visitation", "Hospital Visit",
  "Bereavement Support", "Marriage Support", "Financial Support",
  "Spiritual Direction", "General Pastoral Need", "Other"
];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];

const emptyForm = {
  member_id: "", member_name: "", category: "", title: "", description: "",
  assigned_leader: "", status: "Open", priority: "Medium",
  date_logged: new Date().toISOString().split("T")[0],
  date_resolved: "", confidential: false, outcome: "", private_notes: "",
  follow_up_required: false, follow_up_date: ""
};

export default function PastoralCareFormDialog({ open, onOpenChange, record, members = [], assignableMembers = null, onSave }) {
  const { data: CATEGORIES } = useAppSetting("pastoral_care_types", DEFAULT_CATEGORIES);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({ ...emptyForm, ...record });
    } else {
      setForm(emptyForm);
    }
  }, [record, open]);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleMemberSelect = (memberId) => {
    if (memberId === "__manual__") {
      set("member_id", "");
      set("member_name", "");
    } else {
      const m = members.find((x) => x.id === memberId);
      if (m) {
        set("member_id", m.id);
        set("member_name", `${m.first_name} ${m.last_name}`);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onOpenChange(false);
  };

  const isValid = form.member_name && form.category && form.title && form.date_logged;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>{record ? "Edit Pastoral Care Record" : "Log Pastoral Care Need"}</TenantDialogHeader>

        <div className="space-y-6 py-4">
          {/* Member */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Member</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {members.length > 0 ? (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Select Member</Label>
                  <Select
                    value={form.member_id || "__manual__"}
                    onValueChange={handleMemberSelect}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose a member" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__manual__">— Enter name manually —</SelectItem>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {(!form.member_id || form.member_id === "__manual__") && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Member Name *</Label>
                  <Input value={form.member_name} onChange={(e) => set("member_name", e.target.value)} placeholder="Full name" />
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Title / Subject *</Label>
                <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Brief description of the need" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Detailed notes..." />
              </div>
              <div className="space-y-1.5">
                <Label>Assigned To</Label>
                {assignableMembers && assignableMembers.length > 0 ? (
                  <Select value={form.assigned_leader} onValueChange={(v) => set("assigned_leader", v)}>
                    <SelectTrigger><SelectValue placeholder="Select a unit member" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>— Unassigned —</SelectItem>
                      {assignableMembers.map(m => (
                        <SelectItem key={m.id} value={`${m.first_name} ${m.last_name}`}>
                          {m.first_name} {m.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.assigned_leader} onChange={(e) => set("assigned_leader", e.target.value)} placeholder="Name of leader" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date Logged *</Label>
                <Input type="date" value={form.date_logged} onChange={(e) => set("date_logged", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date Resolved</Label>
                <Input type="date" value={form.date_resolved} onChange={(e) => set("date_resolved", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Outcome & Follow-up */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Outcome & Follow-up</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Outcome / Session Notes</Label>
                <Textarea value={form.outcome} onChange={(e) => set("outcome", e.target.value)} rows={3} placeholder="What happened, what was discussed, result..." />
                <p className="text-xs text-slate-400">This will be visible to the member on their pastoral care page.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Private Notes (Leaders Only)</Label>
                <Textarea value={form.private_notes} onChange={(e) => set("private_notes", e.target.value)} rows={3} placeholder="Internal notes not visible to the member..." />
                <p className="text-xs text-slate-400">These notes are strictly confidential and not shown to members.</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Follow-up Required?</p>
                  <p className="text-xs text-slate-400">Schedule a follow-up for this pastoral need</p>
                </div>
                <Switch checked={!!form.follow_up_required} onCheckedChange={(v) => set("follow_up_required", v)} />
              </div>
              {form.follow_up_required && (
                <div className="space-y-1.5">
                  <Label>Follow-up Date</Label>
                  <Input type="date" value={form.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} />
                </div>
              )}
              <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-100">
                <div>
                  <p className="text-sm font-medium text-slate-700">Confidential</p>
                  <p className="text-xs text-slate-400">Mark this record as sensitive / confidential</p>
                </div>
                <Switch checked={!!form.confidential} onCheckedChange={(v) => set("confidential", v)} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !isValid} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {record ? "Update Record" : "Log Need"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}