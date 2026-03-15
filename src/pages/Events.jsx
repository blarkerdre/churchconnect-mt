import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, CalendarDays, MapPin, Clock, Users, Edit, Trash2, Loader2, MessageSquare } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import SMSDialog from "@/components/sms/SMSDialog";
import { useAppSetting } from "@/hooks/useAppSetting";

const statusColors = {
  "Upcoming": "bg-primary/10 text-primary",
  "Ongoing": "bg-chart-3/10 text-chart-3",
  "Completed": "bg-muted text-muted-foreground",
  "Cancelled": "bg-destructive/10 text-destructive",
};

const categoryColors = {
  "Service": "bg-accent/10 text-accent",
  "Youth Event": "bg-chart-4/10 text-chart-4",
  "Conference": "bg-chart-5/10 text-chart-5",
  "Women's Event": "bg-pink-100 text-pink-700",
  "Men's Event": "bg-primary/10 text-primary",
  "Outreach": "bg-chart-3/10 text-chart-3",
};

function getEventStatus(eventDate) {
  const today = new Date().toISOString().split("T")[0];
  if (eventDate > today) return "Upcoming";
  if (eventDate === today) return "Ongoing";
  return "Completed";
}

export default function Events() {
  const { isAdmin, isUnitLeader } = useAuth();
  const canManage = isAdmin || isUnitLeader;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [smsEvent, setSmsEvent] = useState(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: registrationCounts = {} } = useQuery({
    queryKey: ["event-reg-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("event_registrations").select("event_id");
      if (error) throw error;
      const counts = {};
      data.forEach(r => { counts[r.event_id] = (counts[r.event_id] || 0) + 1; });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      const payload = {
        title: formData.title,
        category: formData.category,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        location: formData.location,
        description: formData.description,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        is_public: true,
      };
      if (editing) {
        const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit("event_update", "events", editing.id, { title: formData.title });
      } else {
        const { error } = await supabase.from("events").insert(payload);
        if (error) throw error;
        await logAudit("event_create", "events", null, { title: formData.title });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: editing ? "Event updated" : "Event created" });
      setDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (event) => {
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) throw error;
      await logAudit("event_delete", "events", event.id, { title: event.title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({ title: "Event deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = events.filter(e => {
    const status = getEventStatus(e.event_date);
    const matchSearch = `${e.title} ${e.location || ""} ${e.category || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || status === statusFilter;
    return matchSearch && matchStatus;
  });

  const upcomingCount = events.filter(e => getEventStatus(e.event_date) === "Upcoming").length;
  const totalRegistrations = Object.values(registrationCounts).reduce((a, b) => a + b, 0);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", category: "Service", event_date: "", start_time: "", location: "", description: "", capacity: "" });
    setDialogOpen(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({ title: e.title, category: e.category || "Service", event_date: e.event_date, start_time: e.start_time || "", location: e.location || "", description: e.description || "", capacity: e.capacity || "" });
    setDialogOpen(true);
  };

  const handleDelete = (e) => {
    if (window.confirm("Delete this event?")) deleteMutation.mutate(e);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{events.length}</p><p className="text-xs text-muted-foreground">Total Events</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{upcomingCount}</p><p className="text-xs text-muted-foreground">Upcoming</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{events.filter(e => getEventStatus(e.event_date) === "Ongoing").length}</p><p className="text-xs text-muted-foreground">Ongoing</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{totalRegistrations}</p><p className="text-xs text-muted-foreground">Registrations</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All", "Upcoming", "Ongoing", "Completed", "Cancelled"].map(s => (
                <SelectItem key={s} value={s}>{s === "All" ? "All Statuses" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" /> New Event</Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm p-16 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No events found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => {
            const status = getEventStatus(e.event_date);
            const regCount = registrationCounts[e.id] || 0;
            return (
              <Card key={e.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-display font-bold text-foreground">{e.title}</h3>
                        {e.category && <Badge className={`border-0 ${categoryColors[e.category] || "bg-muted text-muted-foreground"}`}>{e.category}</Badge>}
                        <Badge className={`border-0 ${statusColors[status]}`}>{status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {e.event_date}</span>
                        {e.start_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {e.start_time}</span>}
                        {e.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {e.location}</span>}
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {regCount}{e.capacity ? `/${e.capacity}` : ""}</span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Notify via SMS"
                          onClick={() => setSmsEvent(e)}>
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Event" : "New Event"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Title</Label><Input value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={form.category || "Service"} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Service", "Youth Event", "Conference", "Women's Event", "Men's Event", "Outreach", "Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={form.event_date || ""} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Time</Label><Input type="time" value={form.start_time || ""} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
              <div><Label>Capacity</Label><Input type="number" value={form.capacity || ""} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="w-full bg-primary">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Save Changes" : "Create Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SMSDialog
        open={!!smsEvent}
        onOpenChange={(o) => { if (!o) setSmsEvent(null); }}
        prefillMessage={smsEvent ? `${smsEvent.title} - ${smsEvent.event_date}${smsEvent.start_time ? ' at ' + smsEvent.start_time : ''}${smsEvent.location ? ', ' + smsEvent.location : ''}` : ""}
        smsType="event"
        referenceId={smsEvent?.id || null}
        title="Notify Members via SMS"
      />
    </div>
  );
}
