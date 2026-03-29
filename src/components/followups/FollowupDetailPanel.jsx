import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Clock, User, Calendar, Flag, Send, CheckCircle2, AlertCircle, TimerReset, Loader2, Phone, Mail, Lightbulb, UserCheck, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const NEXT_STEPS = {
  "First Timer": [
    "Send a welcome message within 24 hours",
    "Invite to next Sunday service",
    "Schedule a brief welcome call",
    "Connect with a care group or unit",
  ],
  "New Convert": [
    "Enrol in Believers Foundation Class (BFC)",
    "Assign a spiritual mentor",
    "Follow up on water baptism",
    "Introduce to Winners Satellite Fellowship",
  ],
  "Pastoral": ["Arrange pastoral visit", "Offer prayer support"],
  "Absentee": ["Check on welfare", "Invite back to service"],
  "General": ["Follow up as scheduled"],
};

const statusColors = {
  Pending: "bg-accent/10 text-accent border-accent/20",
  "In Progress": "bg-primary/10 text-primary border-primary/20",
  Completed: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  Overdue: "bg-destructive/10 text-destructive border-destructive/20",
};

const priorityColors = {
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-primary/10 text-primary",
  High: "bg-chart-5/10 text-chart-5",
  Urgent: "bg-destructive/10 text-destructive",
};

export default function FollowupDetailPanel({ followup, onClose, onUpdate, currentUser, onConverted, isAdmin, isUnitLeader, profileMap = {}, followupUnitMembers = [] }) {
  const [progressNote, setProgressNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [showReassign, setShowReassign] = useState(false);

  const isConvertible = ["First Timer", "New Convert"].includes(followup.category) &&
    followup.member_id &&
    followup.status !== "Completed";

  const handleConvertToActive = async () => {
    if (!followup.member_id) return;
    if (!window.confirm(`Mark ${followup.person_name} as an Active Member?`)) return;
    setConverting(true);
    try {
      const { error: memberErr } = await supabase
        .from("members")
        .update({ membership_status: "Active" })
        .eq("id", followup.member_id);
      if (memberErr) throw memberErr;

      await onUpdate(followup.id, {
        status: "Completed",
        completed_date: new Date().toISOString().split("T")[0],
      });
      toast({ title: `${followup.person_name} converted to Active Member` });
      if (onConverted) onConverted();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConverting(false);
    }
  };

  const handleAddNote = async () => {
    if (!progressNote.trim()) return;
    setSaving(true);
    const existingNotes = followup.notes || "";
    const timestamp = format(new Date(), "dd MMM yyyy, HH:mm");
    const by = currentUser?.full_name || currentUser?.email || "Unknown";
    const newNote = `\n[${timestamp} - ${by}] ${progressNote.trim()}`;
    await onUpdate(followup.id, { notes: existingNotes + newNote });
    setProgressNote("");
    setSaving(false);
  };

  const handleQuickStatus = async (status) => {
    const patch = { status };
    if (status === "Completed") patch.completed_date = new Date().toISOString().split("T")[0];
    await onUpdate(followup.id, patch);
  };

  const isOverdue = followup.due_date && followup.status !== "Completed" &&
    new Date(followup.due_date) < new Date();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{followup.person_name}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge className={`text-xs border ${statusColors[followup.status] || ""}`}>{followup.status}</Badge>
                <Badge className={`text-xs ${priorityColors[followup.priority] || ""}`}>{followup.priority}</Badge>
                {followup.category && (
                  <Badge variant="secondary" className="text-xs">{followup.category}</Badge>
                )}
                {isOverdue && (
                  <Badge className="text-xs bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                    <AlertCircle className="h-2.5 w-2.5" /> Overdue
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Contact Details */}
          {(followup.person_phone || followup.person_email) && (
            <div className="bg-primary/5 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> Contact Details
              </p>
              {followup.person_phone && (
                <a href={`tel:${followup.person_phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Phone className="h-3.5 w-3.5" /> {followup.person_phone}
                </a>
              )}
              {followup.person_email && (
                <a href={`mailto:${followup.person_email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                  <Mail className="h-3.5 w-3.5" /> {followup.person_email}
                </a>
              )}
            </div>
          )}

          {/* Recommended Next Steps */}
          {followup.status !== "Completed" && (() => {
            const steps = NEXT_STEPS[followup.category] || NEXT_STEPS["General"];
            return (
              <div className="bg-accent/10 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-accent-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Recommended Next Steps
                </p>
                <ul className="space-y-1.5">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                      <span className="mt-0.5 h-4 w-4 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Type</p>
              <p className="font-medium text-foreground">{followup.category}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Contact Type</p>
              <p className="font-medium text-foreground">{followup.type || "General"}</p>
            </div>
            {followup.due_date && (
              <div className="space-y-0.5">
                <p className={`text-xs flex items-center gap-1 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                  <Flag className="h-3 w-3" /> Due Date
                </p>
                <p className={`font-medium ${isOverdue ? "text-destructive" : "text-foreground"}`}>
                  {format(new Date(followup.due_date), "dd MMM yyyy")}
                </p>
              </div>
            )}
            {followup.completed_date && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</p>
                <p className="font-medium text-chart-3">{format(new Date(followup.completed_date), "dd MMM yyyy")}</p>
              </div>
            )}
          </div>

          {/* Assigned To */}
          <div className="bg-muted/50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Assigned To
              </p>
              {(isAdmin || isUnitLeader) && followup.status !== "Completed" && (
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setShowReassign(!showReassign)}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Reassign
                </Button>
              )}
            </div>
            <p className="text-sm font-medium text-foreground">
              {followup.assigned_to_name || (followup.assigned_to && profileMap[followup.assigned_to]) || "Unassigned"}
            </p>
            {showReassign && (
              <div className="space-y-2 pt-1">
                <Select
                  onValueChange={async (userId) => {
                    setReassigning(true);
                    await onUpdate(followup.id, { assigned_to: userId });
                    toast({ title: `Reassigned to ${profileMap[userId] || "member"}` });
                    setShowReassign(false);
                    setReassigning(false);
                  }}
                  disabled={reassigning}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={reassigning ? "Reassigning..." : "Select member"} />
                  </SelectTrigger>
                  <SelectContent>
                    {followupUnitMembers.map(uid => (
                      <SelectItem key={uid} value={uid}>
                        {profileMap[uid] || uid}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Notes */}
          {followup.notes && (
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{followup.notes}</p>
            </div>
          )}

          {/* Quick Actions */}
          {followup.status !== "Completed" && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</p>
              <div className="flex gap-2 flex-wrap">
                {followup.status === "Pending" && (
                  <Button size="sm" variant="outline" className="text-primary border-primary/20 hover:bg-primary/10"
                    onClick={() => handleQuickStatus("In Progress")}>
                    <TimerReset className="h-3.5 w-3.5 mr-1" /> Mark In Progress
                  </Button>
                )}
                <Button size="sm" variant="outline" className="text-chart-3 border-chart-3/20 hover:bg-chart-3/10"
                  onClick={() => handleQuickStatus("Completed")}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Completed
                </Button>
                {isConvertible && (
                  <Button size="sm" variant="outline"
                    className="text-primary border-primary/20 hover:bg-primary/10"
                    onClick={handleConvertToActive}
                    disabled={converting}
                  >
                    {converting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                    Convert to Active Member
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add progress note */}
        <div className="p-4 border-t border-border bg-card space-y-2">
          <Textarea
            value={progressNote}
            onChange={e => setProgressNote(e.target.value)}
            placeholder="Add a progress note..."
            rows={2}
            className="text-sm resize-none"
          />
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={saving || !progressNote.trim()}
            className="w-full"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Add Note
          </Button>
        </div>
      </div>
    </div>
  );
}
