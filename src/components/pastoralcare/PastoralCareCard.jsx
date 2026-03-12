import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lock, CalendarClock, User, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

const categoryColors = {
  "Prayer Request": "bg-violet-100 text-violet-700",
  "Counselling Session": "bg-blue-100 text-blue-700",
  "Visitation": "bg-emerald-100 text-emerald-700",
  "Hospital Visit": "bg-red-100 text-red-700",
  "Bereavement Support": "bg-slate-100 text-slate-700",
  "Marriage Support": "bg-pink-100 text-pink-700",
  "Financial Support": "bg-amber-100 text-amber-700",
  "Spiritual Direction": "bg-indigo-100 text-indigo-700",
  "General Pastoral Need": "bg-teal-100 text-teal-700",
  "Other": "bg-gray-100 text-gray-700",
};

const statusColors = {
  "Open": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  "Resolved": "bg-green-100 text-green-700 border-green-200",
  "Closed": "bg-slate-100 text-slate-500 border-slate-200",
};

const priorityDot = {
  "Low": "bg-slate-400",
  "Medium": "bg-amber-400",
  "High": "bg-orange-500",
  "Urgent": "bg-red-600",
};

export default function PastoralCareCard({ record, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[record.category] || "bg-gray-100 text-gray-700"}`}>
              {record.category}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[record.status]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${priorityDot[record.priority]}`} />
              {record.status}
            </span>
            {record.confidential && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
                <Lock className="h-3 w-3" /> Confidential
              </span>
            )}
          </div>
          <h3 className="font-semibold text-slate-800 text-sm truncate">{record.title}</h3>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{record.member_name}</span>
            {record.assigned_leader && <span>• {record.assigned_leader}</span>}
            {record.date_logged && <span>• {format(new Date(record.date_logged), "d MMM yyyy")}</span>}
            {record.follow_up_required && record.follow_up_date && (
              <span className="flex items-center gap-1 text-amber-600">
                <CalendarClock className="h-3 w-3" /> Follow-up: {format(new Date(record.follow_up_date), "d MMM")}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-[#1e3a5f]" onClick={() => onEdit(record)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => onDelete(record)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-sm text-slate-600">
          {record.description && <p><span className="font-medium text-slate-700">Description: </span>{record.description}</p>}
          {record.outcome && <p><span className="font-medium text-slate-700">Outcome: </span>{record.outcome}</p>}
          {record.date_resolved && <p><span className="font-medium text-slate-700">Resolved: </span>{format(new Date(record.date_resolved), "d MMM yyyy")}</p>}
          {record.private_notes && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-xs font-semibold text-amber-700 mb-0.5 flex items-center gap-1">
                <Lock className="h-3 w-3" /> Private Notes (Leaders Only)
              </p>
              <p className="text-xs text-amber-800">{record.private_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}