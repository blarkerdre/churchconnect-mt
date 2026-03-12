import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pin, Pencil, Trash2, Users, User } from "lucide-react";
import { format } from "date-fns";

const renderBodyWithLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => 
    urlRegex.test(part) ? 
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        {part}
      </a> : 
      part
  );
};

export default function AnnouncementCard({ announcement, onEdit, onDelete, isAdmin }) {
  return (
    <Card className={`border-0 shadow-sm p-5 transition-shadow hover:shadow-md ${announcement.pinned ? "border-l-4 border-l-[#c9a84c]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {announcement.pinned && <Pin className="h-3.5 w-3.5 text-[#c9a84c]" />}
            <h3 className="font-semibold text-slate-800">{announcement.title}</h3>
            <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 border">
              <Users className="h-3 w-3 mr-1" />{announcement.audience}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{renderBodyWithLinks(announcement.body)}</p>
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{announcement.author_name || announcement.created_by || "Admin"}</span>
            {announcement.created_date && (
              <span>{format(new Date(announcement.created_date), "dd MMM yyyy, h:mm a")}</span>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(announcement)}>
              <Pencil className="h-3.5 w-3.5 text-slate-500" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(announcement)}>
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}