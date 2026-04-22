import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Users, Pencil, Trash2, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { renderTextWithLinks } from "@/lib/linkify";

const statusColors = {
  Upcoming: "bg-blue-50 text-blue-700 border-blue-200",
  Ongoing: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Completed: "bg-slate-100 text-slate-600 border-slate-200",
  Cancelled: "bg-red-50 text-red-600 border-red-200",
};

const categoryColors = {
  Conference: "bg-purple-50 text-purple-700",
  "Special Service": "bg-indigo-50 text-indigo-700",
  Revival: "bg-orange-50 text-orange-700",
  "Youth Event": "bg-cyan-50 text-cyan-700",
  "Women's Event": "bg-pink-50 text-pink-700",
  "Men's Event": "bg-sky-50 text-sky-700",
  "Children's Event": "bg-yellow-50 text-yellow-700",
  Outreach: "bg-teal-50 text-teal-700",
  Training: "bg-violet-50 text-violet-700",
  Social: "bg-lime-50 text-lime-700",
  Other: "bg-slate-50 text-slate-600",
};

export default function EventCard({ event, registrationCount, onEdit, onDelete, onManage, isAdmin }) {
  const dateStr = event.date ? format(new Date(event.date), "dd MMM yyyy") : "";
  const endDateStr = event.end_date && event.end_date !== event.date ? ` – ${format(new Date(event.end_date), "dd MMM yyyy")}` : "";

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="font-semibold text-slate-800">{event.title}</h3>
            <Badge variant="secondary" className={`text-xs border ${statusColors[event.status] || statusColors.Upcoming}`}>{event.status}</Badge>
            <Badge variant="secondary" className={`text-xs ${categoryColors[event.category] || "bg-slate-50 text-slate-600"}`}>{event.category}</Badge>
          </div>
          {event.description && <p className="text-sm text-slate-500 mb-3 leading-relaxed line-clamp-2">{renderTextWithLinks(event.description)}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-[#1e3a5f]" />{dateStr}{endDateStr}</span>
            {(event.start_time || event.end_time) && (
              <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-[#1e3a5f]" />
                {event.start_time}{event.end_time ? ` – ${event.end_time}` : ""}
              </span>
            )}
            {event.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-[#1e3a5f]" />{event.location}</span>}
            {event.registration_required && (
              <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-emerald-600" />
                {registrationCount} registered{event.capacity ? ` / ${event.capacity}` : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {event.registration_required && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onManage(event)}>
              <ClipboardList className="h-3.5 w-3.5 mr-1" /> Manage
            </Button>
          )}
          {isAdmin && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(event)}>
                <Pencil className="h-3.5 w-3.5 text-slate-500" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(event)}>
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}