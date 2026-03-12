import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, CalendarDays, MapPin, Clock, Users, Edit, Trash2 } from "lucide-react";

const INITIAL_EVENTS = [
  { id: 1, title: "Sunday Worship Service", category: "Service", date: "2025-03-16", time: "10:00 AM", location: "Main Auditorium", status: "Upcoming", description: "Weekly Sunday service with praise and worship", capacity: 300, registrations: 185 },
  { id: 2, title: "Youth Bible Study", category: "Youth Event", date: "2025-03-14", time: "6:00 PM", location: "Youth Hall", status: "Upcoming", description: "Weekly Bible study for young adults", capacity: 50, registrations: 32 },
  { id: 3, title: "Easter Conference 2025", category: "Conference", date: "2025-04-20", time: "9:00 AM", location: "Main Auditorium", status: "Upcoming", description: "Annual Easter conference with guest ministers", capacity: 500, registrations: 248 },
  { id: 4, title: "Women's Prayer Breakfast", category: "Women's Event", date: "2025-03-08", time: "7:00 AM", location: "Fellowship Hall", status: "Completed", description: "Monthly women's fellowship and prayer", capacity: 80, registrations: 65 },
  { id: 5, title: "Community Outreach", category: "Outreach", date: "2025-03-22", time: "11:00 AM", location: "Cardiff City Centre", status: "Upcoming", description: "Street evangelism and community service", capacity: 40, registrations: 28 },
  { id: 6, title: "Men's Fellowship", category: "Men's Event", date: "2025-03-15", time: "4:00 PM", location: "Conference Room", status: "Upcoming", description: "Monthly men's fellowship meeting", capacity: 60, registrations: 35 },
];

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

export default function Events() {
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});

  const filtered = events.filter(e => {
    const matchSearch = `${e.title} ${e.location} ${e.category}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const upcomingCount = events.filter(e => e.status === "Upcoming").length;
  const totalRegistrations = events.reduce((sum, e) => sum + (e.registrations || 0), 0);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", category: "Service", date: "", time: "", location: "", status: "Upcoming", description: "", capacity: 100 });
    setDialogOpen(true);
  };

  const openEdit = (e) => { setEditing(e); setForm({ ...e }); setDialogOpen(true); };

  const handleSave = () => {
    if (editing) {
      setEvents(prev => prev.map(e => e.id === editing.id ? { ...e, ...form } : e));
    } else {
      setEvents(prev => [...prev, { ...form, id: Date.now(), registrations: 0 }]);
    }
    setDialogOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Delete this event?")) setEvents(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{events.length}</p><p className="text-xs text-muted-foreground">Total Events</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{upcomingCount}</p><p className="text-xs text-muted-foreground">Upcoming</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{events.filter(e => e.status === "Ongoing").length}</p><p className="text-xs text-muted-foreground">Ongoing</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{totalRegistrations}</p><p className="text-xs text-muted-foreground">Registrations</p></CardContent></Card>
      </div>

      {/* Controls */}
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
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" /> New Event</Button>
      </div>

      {/* Event Cards */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow-sm p-16 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No events found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => (
            <Card key={e.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-display font-bold text-foreground">{e.title}</h3>
                      <Badge className={`border-0 ${categoryColors[e.category] || "bg-muted text-muted-foreground"}`}>{e.category}</Badge>
                      <Badge className={`border-0 ${statusColors[e.status]}`}>{e.status}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {e.date}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {e.time}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {e.location}</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {e.registrations}/{e.capacity}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
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
              <div>
                <Label>Status</Label>
                <Select value={form.status || "Upcoming"} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Upcoming", "Ongoing", "Completed", "Cancelled"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.date || ""} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><Label>Time</Label><Input value={form.time || ""} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} placeholder="e.g. 10:00 AM" /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div><Label>Capacity</Label><Input type="number" value={form.capacity || ""} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 0 }))} /></div>
            <div><Label>Description</Label><Textarea value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            <Button onClick={handleSave} className="w-full bg-primary">{editing ? "Save Changes" : "Create Event"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
