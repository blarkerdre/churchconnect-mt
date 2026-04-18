import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pin, Pencil, Trash2, Users, User, Heart } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";

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

function AdminLikesPopover({ announcementId }) {
  const { tenantId } = useTenantQuery();

  const { data: likers = [], isLoading } = useQuery({
    queryKey: ["announcement-likers", announcementId, tenantId],
    enabled: !!tenantId && !!announcementId,
    queryFn: async () => {
      const { data: reactions, error } = await supabase
        .from("announcement_reactions")
        .select("user_id, created_at")
        .eq("announcement_id", announcementId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!reactions || reactions.length === 0) return [];

      const userIds = [...new Set(reactions.map((r) => r.user_id))];
      const { data: members } = await supabase
        .from("members")
        .select("user_id, first_name, last_name")
        .eq("tenant_id", tenantId)
        .in("user_id", userIds);

      const memberMap = {};
      (members || []).forEach((m) => {
        memberMap[m.user_id] = `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Unknown";
      });

      return reactions.map((r) => ({
        name: memberMap[r.user_id] || "Unknown member",
        created_at: r.created_at,
      }));
    },
  });

  const count = likers.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-rose-600"
          disabled={isLoading}
        >
          <Heart className="h-3.5 w-3.5 mr-1 text-rose-500" />
          {isLoading ? "…" : count} {count === 1 ? "like" : "likes"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 z-[80]" align="start" sideOffset={4}>
        <div className="px-3 py-2 border-b">
          <p className="text-xs font-semibold text-foreground">Liked by</p>
        </div>
        <div className="max-h-64 overflow-auto">
          {count === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">No likes yet.</p>
          ) : (
            likers.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50">
                <span className="text-foreground truncate">{l.name}</span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {format(new Date(l.created_at), "dd MMM")}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{announcement.author_name || announcement.created_by || "Admin"}</span>
            {announcement.created_date && (
              <span>{format(new Date(announcement.created_date), "dd MMM yyyy, h:mm a")}</span>
            )}
            {isAdmin && <AdminLikesPopover announcementId={announcement.id} />}
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
