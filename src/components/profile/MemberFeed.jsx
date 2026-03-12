import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, CalendarDays, Bell, Pin, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const categoryColors = {
  Conference: "bg-violet-100 text-violet-700",
  "Special Service": "bg-blue-100 text-blue-700",
  Revival: "bg-rose-100 text-rose-700",
  "Youth Event": "bg-amber-100 text-amber-700",
  "Women's Event": "bg-pink-100 text-pink-700",
  "Men's Event": "bg-indigo-100 text-indigo-700",
  "Children's Event": "bg-green-100 text-green-700",
  Outreach: "bg-teal-100 text-teal-700",
  Training: "bg-sky-100 text-sky-700",
  Social: "bg-orange-100 text-orange-700",
  Other: "bg-slate-100 text-slate-600",
};

function AnnouncementItem({ a }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`p-3 rounded-xl border transition-colors ${a.pinned ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-transparent"}`}>
      <div className="flex items-start gap-2">
        {a.pinned ? <Pin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" /> : <Bell className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700 leading-tight">{a.title}</p>
            <button onClick={() => setExpanded(v => !v)} className="shrink-0 text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-200 text-slate-500">{a.audience}</Badge>
            {a.created_date && (
              <span className="text-[11px] text-slate-400">{format(new Date(a.created_date), "d MMM yyyy")}</span>
            )}
          </div>
          {expanded && a.body && (
            <p className="text-xs text-slate-600 mt-2 leading-relaxed border-t border-slate-100 pt-2">{a.body}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EventItem({ event }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
      <div className="h-10 w-10 rounded-lg bg-[#1e3a5f]/10 flex flex-col items-center justify-center shrink-0">
        <span className="text-[11px] font-bold text-[#1e3a5f] leading-none">
          {event.date ? format(parseISO(event.date), "dd") : "—"}
        </span>
        <span className="text-[9px] text-[#1e3a5f]/60 uppercase leading-none mt-0.5">
          {event.date ? format(parseISO(event.date), "MMM") : ""}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">{event.title}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {event.location || "TBC"}
          {event.start_time && ` · ${event.start_time}`}
        </p>
      </div>
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${categoryColors[event.category] || "bg-slate-100 text-slate-600"}`}>
        {event.category}
      </span>
    </div>
  );
}

export default function MemberFeed({ member }) {
  const { data: allAnnouncements = [], isLoading: loadingAnn } = useQuery({
    queryKey: ["announcements-feed"],
    queryFn: () => base44.entities.Announcement.list("-created_date", 50),
  });

  const { data: allEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["events-feed"],
    queryFn: () => base44.entities.Event.list("-date", 50),
  });

  // Filter announcements relevant to this member
  const relevantAnnouncements = allAnnouncements.filter(a => {
    if (a.audience === "Leaders Only") return false;
    if (a.audience === "All Members") return true;
    if (member?.church_unit && member.church_unit !== "None" && a.audience === member.church_unit) return true;
    return false;
  }).sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  // Filter upcoming events
  const upcomingEvents = allEvents.filter(e =>
    e.status === "Upcoming" || e.status === "Ongoing"
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">My Feed</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <Tabs defaultValue="announcements">
          <TabsList className="bg-slate-100 w-full">
            <TabsTrigger value="announcements" className="flex-1 flex items-center gap-1.5 text-xs">
              <Megaphone className="h-3.5 w-3.5" />
              Announcements
              {relevantAnnouncements.length > 0 && (
                <span className="ml-1 bg-[#c9a84c] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {relevantAnnouncements.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1 flex items-center gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Events
              {upcomingEvents.length > 0 && (
                <span className="ml-1 bg-[#1e3a5f] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {upcomingEvents.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="mt-3">
            {loadingAnn ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : relevantAnnouncements.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No announcements for you right now</p>
            ) : (
              <div className="space-y-2">
                {relevantAnnouncements.map(a => <AnnouncementItem key={a.id} a={a} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-3">
            {loadingEvents ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(e => <EventItem key={e.id} event={e} />)}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}