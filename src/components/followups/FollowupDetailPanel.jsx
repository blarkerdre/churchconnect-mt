import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Clock, User, Calendar, Flag, Send, CheckCircle2, AlertCircle, TimerReset, Loader2, Phone, Mail, Lightbulb, UserCheck } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

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
  "Pastoral Care": ["Arrange pastoral visit", "Offer prayer support"],
  "Bereavement": ["Send condolences", "Arrange bereavement visit"],
  "General": ["Follow up as scheduled"],
};

const statusColors = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

const priorityColors = {
  Low: "bg-slate-100 text-slate-600",
  Medium: "bg-blue-50 text-blue-600",
  High: "bg-orange-50 text-orange-600",
  Urgent: "bg-red-50 text-red-600",
};

const categoryColors = {
  "New Convert": "bg-purple-50 text-purple-700",
  "First Timer": "bg-indigo-50 text-indigo-700",
  "Pastoral Care": "bg-rose-50 text-rose-700",
  "Membership Inquiry": "bg-cyan-50 text-cyan-700",
  "Bereavement": "bg-slate-100 text-slate-600",
  "Hospital Visit": "bg-orange-50 text-orange-700",
  "General": "bg-slate-50 text-slate-600",
};

export default function FollowupDetailPanel({ followup, onClose, onUpdate, currentUser, onConverted }) {
  const [progressNote, setProgressNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);

  const isConvertible = ["First Timer", "New Convert"].includes(followup.category) &&
    followup.member_id &&
    followup.status !== "Cancelled" &&
    !converting;

  const handleConvertToActive = async () => {
    if (!followup.member_id) return;
    if (!window.confirm(`Mark ${followup.person_name} as an Active Member? This will also record their Believers Foundation Class (BFC) as completed.`)) return;
    setConverting(true);
    try {
      await base44.entities.Member.update(followup.member_id, {
        membership_status: "Active",
        bfc_completed: true,
      });
      await onUpdate(followup.id, {
        status: "Completed",
        completed_date: new Date().toISOString().split("T")[0],
        outcome: `${followup.person_name} has completed the Believers Foundation Class (BFC) and been converted to Active Member.`,
      });
      if (onConverted) onConverted();
    } finally {
      setConverting(false);
    }
  };

  const log = followup.progress_log || [];

  const handleAddNote = async () => {
    if (!progressNote.trim()) return;
    setSaving(true);
    const newEntry = {
      date: new Date().toISOString(),
      note: progressNote.trim(),
      by: currentUser?.full_name || currentUser?.email || "Unknown",
    };
    const updated = { ...followup, progress_log: [...log, newEntry] };
    await onUpdate(followup.id, { progress_log: updated.progress_log });
    setProgressNote("");
    setSaving(false);
  };

  const handleQuickStatus = async (status) => {
    const patch = { status };
    if (status === "Completed") patch.completed_date = new Date().toISOString().split("T")[0];
    await onUpdate(followup.id, patch);
  };

  const isOverdue = followup.due_date && followup.status !== "Completed" && followup.status !== "Cancelled" &&
    new Date(followup.due_date) < new Date();

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-slate-800 truncate">{followup.person_name}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge className={`text-xs border ${statusColors[followup.status]}`}>{followup.status}</Badge>
                <Badge className={`text-xs ${priorityColors[followup.priority]}`}>{followup.priority}</Badge>
                {followup.category && (
                  <Badge className={`text-xs ${categoryColors[followup.category] || "bg-slate-100 text-slate-600"}`}>
                    {followup.category}
                  </Badge>
                )}
                {isOverdue && (
                  <Badge className="text-xs bg-red-100 text-red-600 border border-red-200 flex items-center gap-1">
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
          {(followup.notes || followup.category === "First Timer" || followup.category === "New Convert") && (() => {
            // Extract contact info from notes (auto-created follow-ups store them there)
            const noteText = followup.notes || "";
            const phoneMatch = noteText.match(/Phone:\s*([^\s,]+)/);
            const emailMatch = noteText.match(/Email:\s*([^\s,]+)/);
            if (!phoneMatch && !emailMatch) return null;
            return (
              <div className="bg-blue-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Contact Details
                </p>
                {phoneMatch && (
                  <a href={`tel:${phoneMatch[1]}`} className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {phoneMatch[1]}
                  </a>
                )}
                {emailMatch && (
                  <a href={`mailto:${emailMatch[1]}`} className="flex items-center gap-2 text-sm text-blue-700 hover:underline">
                    <Mail className="h-3.5 w-3.5" /> {emailMatch[1]}
                  </a>
                )}
              </div>
            );
          })()}

          {/* Recommended Next Steps */}
          {(followup.status !== "Completed" && followup.status !== "Cancelled") && (() => {
            const steps = NEXT_STEPS[followup.category] || NEXT_STEPS["General"];
            return (
              <div className="bg-amber-50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5" /> Recommended Next Steps
                </p>
                <ul className="space-y-1.5">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                      <span className="mt-0.5 h-4 w-4 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
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
              <p className="text-xs text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Contact Type</p>
              <p className="font-medium text-slate-700">{followup.type}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-slate-400 flex items-center gap-1"><User className="h-3 w-3" /> Assigned To</p>
              <p className="font-medium text-slate-700">{followup.assigned_to}</p>
            </div>
            {followup.scheduled_date && (
              <div className="space-y-0.5">
                <p className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> Scheduled</p>
                <p className="font-medium text-slate-700">{format(new Date(followup.scheduled_date), "dd MMM yyyy")}</p>
              </div>
            )}
            {followup.due_date && (
              <div className="space-y-0.5">
                <p className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-400" : "text-slate-400"}`}>
                  <Flag className="h-3 w-3" /> Due Date
                </p>
                <p className={`font-medium ${isOverdue ? "text-red-600" : "text-slate-700"}`}>
                  {format(new Date(followup.due_date), "dd MMM yyyy")}
                </p>
              </div>
            )}
            {followup.completed_date && (
              <div className="space-y-0.5">
                <p className="text-xs text-slate-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</p>
                <p className="font-medium text-emerald-700">{format(new Date(followup.completed_date), "dd MMM yyyy")}</p>
              </div>
            )}
          </div>

          {/* Outcome */}
          {followup.outcome && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Outcome</p>
              <p className="text-sm text-slate-700">{followup.outcome}</p>
            </div>
          )}

          {/* Notes */}
          {followup.notes && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-500 mb-1">Notes</p>
              <p className="text-sm text-slate-700">{followup.notes}</p>
            </div>
          )}

          {/* Quick status buttons */}
          {(followup.status !== "Cancelled" || isConvertible) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quick Actions</p>
              <div className="flex gap-2 flex-wrap">
                {followup.status === "Pending" && (
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => handleQuickStatus("In Progress")}>
                    <TimerReset className="h-3.5 w-3.5 mr-1" /> Mark In Progress
                  </Button>
                )}
                {followup.status !== "Completed" && followup.status !== "Cancelled" && (
                  <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => handleQuickStatus("Completed")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Completed
                  </Button>
                )}
                {["First Timer", "New Convert"].includes(followup.category) && followup.member_id && followup.status !== "Cancelled" && (
                  <Button size="sm" variant="outline"
                    className="text-purple-700 border-purple-200 hover:bg-purple-50"
                    onClick={handleConvertToActive}
                    disabled={converting}
                  >
                    {converting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                    Convert to Active Member
                  </Button>
                )}
              </div>
              {["First Timer", "New Convert"].includes(followup.category) && followup.member_id && followup.status !== "Cancelled" && (
                <p className="text-[11px] text-slate-400">Use "Convert to Active Member" once they have completed the Believers Foundation Class (BFC).</p>
              )}
            </div>
          )}

          {/* Progress log / history */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Progress History ({log.length})</p>
            {log.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No progress notes yet.</p>
            ) : (
              <div className="space-y-2">
                {[...log].reverse().map((entry, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-sm text-slate-700">{entry.note}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {entry.by} · {entry.date ? format(new Date(entry.date), "dd MMM yyyy, HH:mm") : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add progress note */}
        <div className="p-4 border-t border-slate-100 bg-white space-y-2">
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
            className="w-full bg-[#1e3a5f] hover:bg-[#152d4a]"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Add Note
          </Button>
        </div>
      </div>
    </div>
  );
}