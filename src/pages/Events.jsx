import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, CalendarDays, MapPin, Clock, Users, Edit, Trash2, Loader2, MessageSquare, Globe, Monitor, Repeat } from "lucide-react";
import { addDays, addWeeks, addMonths, format, parseISO, isBefore, isEqual } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit";
import SMSDialog from "@/components/sms/SMSDialog";
import { useAppSetting } from "@/hooks/useAppSetting";
import { useChurchUnits } from "@/hooks/useChurchUnits";

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

const EVENT_MODES = ["In Person", "Online", "Hybrid"];

const modeIcons = {
  "In Person": MapPin,
  "Online": Globe,
  "Hybrid": Monitor,
};

function getEventStatus(eventDate) {
  const today = new Date().toISOString().split("T")[0];
  if (eventDate > today) return "Upcoming";
  if (eventDate === today) return "Ongoing";
  return "Completed";
}

export default function Events() {
  const { data: EVENT_CATEGORIES } = useAppSetting("event_categories", ["Service", "Youth Event", "Conference", "Women's Event", "Men's Event", "Outreach", "Other"]);
  const { isAdmin, isUnitLeader, isWSFLeader, user, leaderUnits } = useAuth();
  const canManage = isAdmin || isUnitLeader || isWSFLeader;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [smsEvent, setSmsEvent] = useState(null);

  const { data: churchUnitsData = [] } = useChurchUnits();

  // Get WSF centre names for WSF leader scoping
  const { data: myWsfCentres = [] } = useQuery({
    queryKey: ["my-wsf-centres", user?.id],
    queryFn: async () => {
      const { data: memberData } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!memberData) return [];
      const { data, error } = await supabase
        .from("wsf_centres")
        .select("id, name")
        .eq("leader_id", memberData.id)
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && isWSFLeader,
  });

  // Build AUDIENCES list
  const allAudiences = ["All Members", ...churchUnitsData.map(u => u.name), ...myWsfCentres.map(c => c.name), "WSF", "WSF Leaders", "Leaders Only"];
  const uniqueAudiences = [...new Set(allAudiences)];

  // Determine available audiences for the current user
  const getAvailableAudiences = () => {
    if (isAdmin) return uniqueAudiences;
    if (isWSFLeader && !isUnitLeader) return myWsfCentres.map(c => c.name);
    if (isUnitLeader && !isWSFLeader) return leaderUnits;
    if (isUnitLeader && isWSFLeader) return [...leaderUnits, ...myWsfCentres.map(c => c.name)];
    return [];
  };
  const availableAudiences = getAvailableAudiences();
  const lockedAudience = availableAudiences.length === 1 ? availableAudiences[0] : null;

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

  const generateOccurrences = (parentEvent, parentId) => {
    const freq = parentEvent.recurrence_frequency;
    const endDate = parseISO(parentEvent.recurrence_end_date);
    const children = [];
    let current = parseISO(parentEvent.event_date);
    let count = 0;

    while (count < 52) {
      if (freq === "Daily") current = addDays(current, 1);
      else if (freq === "Weekly") current = addWeeks(current, 1);
      else if (freq === "Biweekly") current = addWeeks(current, 2);
      else current = addMonths(current, 1);

      if (isBefore(endDate, current)) break;
      count++;
      children.push({
        title: parentEvent.title,
        category: parentEvent.category,
        event_date: format(current, "yyyy-MM-dd"),
        start_time: parentEvent.start_time || null,
        end_time: parentEvent.end_time || null,
        location: parentEvent.location,
        description: parentEvent.description,
        event_mode: parentEvent.event_mode || "In Person",
        audience: parentEvent.audience || "All Members",
        is_public: true,
        is_recurring: true,
        recurrence_frequency: freq,
        recurrence_end_date: parentEvent.recurrence_end_date,
        recurrence_parent_id: parentId,
        reminder_days_before: parentEvent.reminder_days_before?.length ? parentEvent.reminder_days_before : null,
        reminder_hours_before: parentEvent.reminder_hours_before?.length ? parentEvent.reminder_hours_before : null,
        reminder_sent: false,
      });
    }
    return children;
  };

  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      const payload = {
        title: formData.title,
        category: formData.category,
        event_date: formData.event_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        location: formData.location,
        description: formData.description,
        event_mode: formData.event_mode || "In Person",
        audience: formData.audience || "All Members",
        is_public: true,
        is_recurring: formData.is_recurring || false,
        recurrence_frequency: formData.is_recurring ? formData.recurrence_frequency : null,
        recurrence_end_date: formData.is_recurring ? formData.recurrence_end_date : null,
        reminder_days_before: formData.reminder_days_before?.length ? formData.reminder_days_before : null,
        reminder_sent: false,
      };
      if (editing) {
        const { error } = await supabase.from("events").update(payload).eq("id", editing.id);
        if (error) throw error;
        await logAudit("event_update", "events", editing.id, { title: formData.title });
      } else {
        const { data: inserted, error } = await supabase.from("events").insert(payload).select().single();
        if (error) throw error;
        await logAudit("event_create", "events", inserted.id, { title: formData.title });

        // Generate child occurrences for recurring events
        if (formData.is_recurring && formData.recurrence_end_date) {
          const children = generateOccurrences(
            { ...formData, event_date: formData.event_date },
            inserted.id
          );
          if (children.length > 0) {
            const { error: childError } = await supabase.from("events").insert(children);
            if (childError) console.error("Failed to create occurrences:", childError);
          }
        }
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
      // If parent recurring event, children cascade via FK
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

    // Scope filtering for non-admin users
    if (!isAdmin) {
      const audience = e.audience || "All Members";
      if (audience !== "All Members") {
        // Unit leaders see their unit events + All Members
        if (isUnitLeader && !leaderUnits.includes(audience)) {
          // WSF leaders also check their centres
          if (isWSFLeader && myWsfCentres.some(c => c.name === audience)) {
            // allow
          } else if (!isWSFLeader) {
            return false;
          } else {
            return false;
          }
        }
        // WSF-only leaders see their centre events + All Members
        if (!isUnitLeader && isWSFLeader && !myWsfCentres.some(c => c.name === audience)) {
          return false;
        }
      }
    }

    return matchSearch && matchStatus;
  });

  const upcomingCount = events.filter(e => getEventStatus(e.event_date) === "Upcoming").length;
  const totalRegistrations = Object.values(registrationCounts).reduce((a, b) => a + b, 0);

  const openNew = () => {
    setEditing(null);
    setForm({
      title: "", category: "Service", event_date: "", start_time: "", end_time: "",
      location: "", description: "", event_mode: "In Person",
      audience: lockedAudience || "All Members",
      is_recurring: false, recurrence_frequency: "Weekly", recurrence_end_date: "",
      reminder_days_before: [],
    });
    setDialogOpen(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({
      title: e.title, category: e.category || "Service", event_date: e.event_date,
      start_time: e.start_time || "", end_time: e.end_time || "",
      location: e.location || "", description: e.description || "",
      event_mode: e.event_mode || "In Person",
      audience: e.audience || "All Members",
      is_recurring: e.is_recurring || false,
      recurrence_frequency: e.recurrence_frequency || "Weekly",
      recurrence_end_date: e.recurrence_end_date || "",
      reminder_days_before: e.reminder_days_before || [],
    });
    setDialogOpen(true);
  };

  const handleDelete = (e) => {
    const msg = e.is_recurring && !e.recurrence_parent_id
      ? "Delete this recurring event and all its occurrences?"
      : "Delete this event?";
    if (window.confirm(msg)) deleteMutation.mutate(e);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-foreground">{events.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-primary">{upcomingCount}</p><p className="text-xs text-muted-foreground">Upcoming</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-chart-3">{events.filter(e => getEventStatus(e.event_date) === "Ongoing").length}</p><p className="text-xs text-muted-foreground">Ongoing</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-accent">{totalRegistrations}</p><p className="text-xs text-muted-foreground">Registrations</p></CardContent></Card>
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
          <Button onClick={openNew} className="w-full sm:w-auto bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" /> New Event</Button>
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
            const ModeIcon = modeIcons[e.event_mode] || MapPin;
            const audience = e.audience || "All Members";
            return (
              <Card key={e.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="font-display font-bold text-foreground">{e.title}</h3>
                        {e.category && <Badge className={`border-0 ${categoryColors[e.category] || "bg-muted text-muted-foreground"}`}>{e.category}</Badge>}
                        <Badge className={`border-0 ${statusColors[status]}`}>{status}</Badge>
                        {e.event_mode && e.event_mode !== "In Person" && (
                          <Badge variant="outline" className="gap-1 text-xs"><ModeIcon className="h-3 w-3" />{e.event_mode}</Badge>
                        )}
                        {e.is_recurring && (
                          <Badge variant="outline" className="gap-1 text-xs text-chart-4 border-chart-4/30"><Repeat className="h-3 w-3" />Recurring</Badge>
                        )}
                        {audience !== "All Members" && (
                          <Badge variant="outline" className="text-xs">{audience}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {e.event_date}</span>
                        {e.start_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {e.start_time}{e.end_time ? ` – ${e.end_time}` : ""}</span>}
                        {e.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {e.location}</span>}
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {regCount}</span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Notify via SMS"
                          onClick={() => setSmsEvent(e)}>
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Edit className="h-4 w-4" /></Button>
                        {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleDelete(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
                    {EVENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Event Mode</Label>
                <Select value={form.event_mode || "In Person"} onValueChange={v => setForm(f => ({ ...f, event_mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Audience */}
            <div>
              <Label>Audience</Label>
              {lockedAudience ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {lockedAudience}
                  <span className="ml-2 text-xs text-muted-foreground">(locked to your scope)</span>
                </div>
              ) : (
                <Select value={form.audience || "All Members"} onValueChange={v => setForm(f => ({ ...f, audience: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(isAdmin ? uniqueAudiences : availableAudiences).map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div><Label>Date</Label><Input type="date" value={form.event_date || ""} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Time</Label><Input type="time" value={form.start_time || ""} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
              <div><Label>End Time</Label><Input type="time" value={form.end_time || ""} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>

            {/* Recurrence */}
            {!editing?.recurrence_parent_id && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Recurring Event</p>
                      <p className="text-xs text-muted-foreground">Auto-generate repeating occurrences</p>
                    </div>
                  </div>
                  <Switch checked={!!form.is_recurring} onCheckedChange={v => setForm(f => ({ ...f, is_recurring: v }))} disabled={!!editing} />
                </div>
                {form.is_recurring && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Frequency</Label>
                      <Select value={form.recurrence_frequency || "Weekly"} onValueChange={v => setForm(f => ({ ...f, recurrence_frequency: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Weekly", "Biweekly", "Monthly"].map(fr => <SelectItem key={fr} value={fr}>{fr}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Repeat Until</Label>
                      <Input type="date" value={form.recurrence_end_date || ""} onChange={e => setForm(f => ({ ...f, recurrence_end_date: e.target.value }))} min={form.event_date || undefined} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reminders */}
            <div className="space-y-1.5">
              <Label>Reminders</Label>
              <div className="flex flex-wrap gap-3">
                {[{ value: 1, label: "1 day before" }, { value: 3, label: "3 days before" }, { value: 7, label: "1 week before" }].map(opt => (
                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-sm text-foreground">
                    <Checkbox
                      checked={(form.reminder_days_before || []).includes(opt.value)}
                      onCheckedChange={() => {
                        const curr = form.reminder_days_before || [];
                        setForm(f => ({
                          ...f,
                          reminder_days_before: curr.includes(opt.value) ? curr.filter(d => d !== opt.value) : [...curr, opt.value].sort((a, b) => a - b),
                        }));
                      }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || (form.is_recurring && !form.recurrence_end_date)} className="w-full bg-primary">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Save Changes" : form.is_recurring ? "Create Recurring Event" : "Create Event"}
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
        title={smsEvent ? `Notify: ${smsEvent.title}` : ""}
      />
    </div>
  );
}
