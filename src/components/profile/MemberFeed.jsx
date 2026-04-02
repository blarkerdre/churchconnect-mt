
import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Megaphone, CalendarDays, Bell, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, RefreshCw, Heart, MapPin, Clock, Users, Monitor
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";

function AnnouncementItem({ a, onRead, onOpen, user, tenantId, withTenant }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: reactions = [] } = useQuery({
    queryKey: ["announcement-reactions", a.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcement_reactions")
        .select("id, user_id")
        .eq("announcement_id", a.id)
        .eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const isLiked = reactions.some(r => r.user_id === user?.id);
  const likeCount = reactions.length;

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        const myReaction = reactions.find(r => r.user_id === user.id);
        if (myReaction) {
          await supabase.from("announcement_reactions").delete().eq("id", myReaction.id);
        }
      } else {
        await supabase.from("announcement_reactions").insert(withTenant({
          announcement_id: a.id,
          user_id: user.id,
        }));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement-reactions", a.id] });
    },
  });

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!expanded) onRead(a.id);
  };

  return (
    <div className="p-3 rounded-xl border transition-colors bg-muted/30 border-border">
      <div className="flex items-start gap-2">
        <Bell className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-tight cursor-pointer hover:underline" onClick={() => { onRead(a.id); onOpen(a); }}>{a.title}</p>
            <button onClick={handleExpand} className="shrink-0 text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {a.target_audience && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{a.target_audience}</Badge>
            )}
            {a.publish_date && (
              <span className="text-[11px] text-muted-foreground">{format(new Date(a.publish_date), "d MMM yyyy")}</span>
            )}
          </div>
          {expanded && a.content && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-t border-border pt-2">{a.content}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => likeMutation.mutate()}
              disabled={likeMutation.isPending}
              className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
              {likeCount > 0 && <span className="text-[10px] font-medium">{likeCount}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventItem({ event, member, onRead, onOpen, user, tenantId, withTenant }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: registration } = useQuery({
    queryKey: ["event-reg", event.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("id")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && !!event.requires_registration,
  });

  const { data: reactions = [] } = useQuery({
    queryKey: ["event-reactions", event.id, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_reactions")
        .select("id, user_id")
        .eq("event_id", event.id)
        .eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const isLiked = reactions.some(r => r.user_id === user?.id);
  const likeCount = reactions.length;

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (isLiked) {
        const myReaction = reactions.find(r => r.user_id === user.id);
        if (myReaction) {
          await supabase.from("event_reactions").delete().eq("id", myReaction.id);
        }
      } else {
        await supabase.from("event_reactions").insert(withTenant({
          event_id: event.id,
          user_id: user.id,
        }));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-reactions", event.id] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const payload = withTenant({
        event_id: event.id,
        user_id: user.id,
        member_id: member?.id || null,
        status: "registered",
      });
      const { error } = await supabase.from("event_registrations").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-reg", event.id] });
      toast({ title: "Registered!", description: `You're registered for ${event.title}` });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleExpand = () => {
    setExpanded(v => !v);
    if (!expanded) onRead(event.id);
  };

  const isRegistered = !!registration;
  const modeIcon = { "Online": <Monitor className="h-3 w-3" />, "Hybrid": <Monitor className="h-3 w-3" /> };

  return (
    <div className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
          <span className="text-[11px] font-bold text-primary leading-none">
            {event.event_date ? format(parseISO(event.event_date), "dd") : "—"}
          </span>
          <span className="text-[9px] text-primary/60 uppercase leading-none mt-0.5">
            {event.event_date ? format(parseISO(event.event_date), "MMM") : ""}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground truncate cursor-pointer hover:underline" onClick={() => { onRead(event.id); onOpen(event); }}>{event.title}</p>
            <button onClick={handleExpand} className="shrink-0 text-muted-foreground hover:text-foreground p-0.5">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {event.location || "TBC"}
            {event.start_time && ` · ${event.start_time}`}
          </p>
          {expanded && (
            <div className="mt-2 border-t border-border pt-2 space-y-1.5">
              {event.description && (
                <p className="text-xs text-muted-foreground leading-relaxed">{event.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {event.end_time && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Ends {event.end_time}</span>
                )}
                {event.event_mode && event.event_mode !== "In Person" && (
                  <span className="flex items-center gap-1">{modeIcon[event.event_mode] || null} {event.event_mode}</span>
                )}
                {event.audience && event.audience !== "All Members" && (
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {event.audience}</span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.location}</span>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => likeMutation.mutate()}
              disabled={likeMutation.isPending}
              className="flex items-center gap-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-destructive text-destructive" : ""}`} />
              {likeCount > 0 && <span className="text-[10px] font-medium">{likeCount}</span>}
            </button>
            {event.requires_registration && (
              isRegistered ? (
                <Badge className="bg-chart-3/10 text-chart-3 border-0 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Registered
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2"
                  onClick={() => registerMutation.mutate()}
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Register
                </Button>
              )
            )}
          </div>
        </div>
        {event.category && (
          <Badge variant="secondary" className="text-[10px] shrink-0">{event.category}</Badge>
        )}
      </div>
    </div>
  );
}

export default function MemberFeed({ member }) {
  const { user } = useAuth();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const queryClient = useQueryClient();
  const [readIds, setReadIds] = useState(new Set());
  const [readEventIds, setReadEventIds] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleReadAnnouncement = useCallback((id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleReadEvent = useCallback((id) => {
    setReadEventIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const { data: announcements = [], isLoading: loadingAnn } = useQuery({
    queryKey: ["member-feed-announcements", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("announcements")
          .select("*")
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(50)
      );
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["member-feed-events", tenantId],
    queryFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await scopeQuery(
        supabase
          .from("events")
          .select("*")
          .gte("event_date", today)
          .order("event_date")
          .limit(20)
      );
      if (error) throw error;
      return data;
    },
  });

  const relevantAnnouncements = announcements.filter(a => {
    if (a.target_audience === "Leaders Only") return false;
    if (a.target_audience === "All" || a.target_audience === "All Members" || !a.target_audience) return true;
    if (member?.church_unit && member.church_unit !== "None" && a.target_audience === member.church_unit) return true;
    return false;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    // Mark all currently visible items as "read" so only new items after refresh appear unread
    setReadIds(prev => {
      const next = new Set(prev);
      relevantAnnouncements.forEach(a => next.add(a.id));
      return next;
    });
    setReadEventIds(prev => {
      const next = new Set(prev);
      events.forEach(e => next.add(e.id));
      return next;
    });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["member-feed-announcements", tenantId] }),
      queryClient.invalidateQueries({ queryKey: ["member-feed-events", tenantId] }),
    ]);
    setTimeout(() => setRefreshing(false), 600);
  };

  const unreadAnnCount = Math.max(0, relevantAnnouncements.filter(a => !readIds.has(a.id)).length);
  const unreadEventCount = Math.max(0, events.filter(e => !readEventIds.has(e.id)).length);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Feed</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="pt-3">
        <Tabs defaultValue="announcements">
          <TabsList className="bg-muted w-full">
            <TabsTrigger value="announcements" className="flex-1 flex items-center gap-1.5 text-xs">
              <Megaphone className="h-3.5 w-3.5" />
              Announcements
              {unreadAnnCount > 0 && (
                <span className="ml-1 bg-accent text-accent-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {unreadAnnCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="events" className="flex-1 flex items-center gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Events
              {unreadEventCount > 0 && (
                <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {unreadEventCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="mt-3">
            {loadingAnn ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : relevantAnnouncements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No announcements for you right now</p>
            ) : (
              <div className="space-y-2">
                {relevantAnnouncements.map(a => (
                  <AnnouncementItem
                    key={a.id}
                    a={a}
                    onRead={handleReadAnnouncement}
                    onOpen={setSelectedAnnouncement}
                    user={user}
                    tenantId={tenantId}
                    withTenant={withTenant}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="events" className="mt-3">
            {loadingEvents ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {events.map(e => (
                  <EventItem
                    key={e.id}
                    event={e}
                    member={member}
                    onRead={handleReadEvent}
                    onOpen={setSelectedEvent}
                    user={user}
                    tenantId={tenantId}
                    withTenant={withTenant}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Announcement Detail Dialog */}
        <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">{selectedAnnouncement?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedAnnouncement?.target_audience && (
                  <Badge variant="outline" className="text-xs">{selectedAnnouncement.target_audience}</Badge>
                )}
                {selectedAnnouncement?.publish_date && (
                  <span className="text-xs text-muted-foreground">{format(new Date(selectedAnnouncement.publish_date), "d MMM yyyy")}</span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedAnnouncement?.content}</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Event Detail Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base">{selectedEvent?.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                {selectedEvent?.event_date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(parseISO(selectedEvent.event_date), "EEEE, d MMMM yyyy")}
                  </span>
                )}
                {selectedEvent?.start_time && (
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {selectedEvent.start_time}{selectedEvent.end_time ? ` – ${selectedEvent.end_time}` : ""}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                {selectedEvent?.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {selectedEvent.location}</span>
                )}
                {selectedEvent?.event_mode && selectedEvent.event_mode !== "In Person" && (
                  <span className="flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> {selectedEvent.event_mode}</span>
                )}
                {selectedEvent?.audience && selectedEvent.audience !== "All Members" && (
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {selectedEvent.audience}</span>
                )}
              </div>
              {selectedEvent?.category && <Badge variant="secondary" className="text-xs">{selectedEvent.category}</Badge>}
              {selectedEvent?.description && (
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap border-t border-border pt-3">{selectedEvent.description}</p>
              )}
              {selectedEvent?.requires_registration && (
                <div className="pt-2">
                  <Badge className="bg-primary/10 text-primary border-0 text-xs">Registration Required</Badge>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
