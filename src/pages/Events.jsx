import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, CalendarDays } from "lucide-react";
import PrintReportButton from "@/components/PrintReportButton";
import EventCard from "@/components/events/EventCard";
import EventFormDialog from "@/components/events/EventFormDialog";
import RegistrationsDialog from "@/components/events/RegistrationsDialog";

const STATUSES = ["All", "Upcoming", "Ongoing", "Completed", "Cancelled"];

export default function Events() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [managingEvent, setManagingEvent] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 200),
  });

  const { data: allRegistrations = [] } = useQuery({
    queryKey: ["allRegistrations"],
    queryFn: () => base44.entities.EventRegistration.list("-created_date", 1000),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const created = await base44.entities.Event.create(data);
      // Trigger email notifications to relevant members
      await base44.functions.invoke("notifyNewEvent", { event_id: created.id });
      return created;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Event.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const handleSave = async (data) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setEditing(null);
  };

  const isAdmin = currentUser?.role === "admin";
  const isUnitLeader = currentUser?.role === "unit_leader";
  const canCreate = isAdmin || isUnitLeader;
  const isRegularUser = currentUser && !isUnitLeader;

  // Fetch member profile to know their units
  const { data: myMemberArr = [] } = useQuery({
    queryKey: ["my-member-events", currentUser?.email],
    queryFn: () => base44.entities.Member.filter({ email: currentUser.email }),
    enabled: !!(currentUser?.email && (isUnitLeader || isRegularUser)),
  });
  const myUnits = myMemberArr[0]?.church_units || [];

  // Map church_unit → event category for unit leaders
  const unitCategoryMap = {
    "Youth Ministry": "Youth Event",
    "Women's Ministry": "Women's Event",
    "Men's Ministry": "Men's Event",
    "Children's Ministry": "Children's Event",
    "Evangelism": "Outreach",
  };

  const visibleEvents = events.filter(e => {
    if (isAdmin) return true;
    const audience = e.audience || "All Members";
    if (audience === "All Members") return true;
    if (audience === "Leaders Only") return isUnitLeader;
    return myUnits.includes(audience);
  });

  const upcomingCount = visibleEvents.filter(e => e.status === "Upcoming").length;
  const ongoingCount = visibleEvents.filter(e => e.status === "Ongoing").length;

  const filtered = visibleEvents.filter(e => {
    const matchSearch = e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.location?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const getRegistrationCount = (eventId) =>
    allRegistrations.filter(r => r.event_id === eventId).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{visibleEvents.length}</p>
          <p className="text-xs text-slate-400">Total Events</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{upcomingCount}</p>
          <p className="text-xs text-slate-400">Upcoming</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{ongoingCount}</p>
          <p className="text-xs text-slate-400">Ongoing</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-violet-600">{allRegistrations.length}</p>
          <p className="text-xs text-slate-400">Registrations</p>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s === "All" ? "All Statuses" : s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {(isAdmin || isUnitLeader) && (
            <PrintReportButton
              label="Print Report"
              buildRows={() => ({
                title: "Events Report",
                headers: ["Title", "Category", "Date", "Location", "Status"],
                rows: filtered.map(e => [
                  e.title,
                  e.category || "",
                  e.date || "",
                  e.location || "",
                  e.status || "",
                ]),
              })}
            />
          )}
          {canCreate && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
              <Plus className="h-4 w-4 mr-2" /> New Event
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm p-16 text-center text-slate-400">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No events found</p>
          {isAdmin && <p className="text-sm mt-1">Click "New Event" to create one</p>}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => (
            <EventCard
              key={e.id}
              event={e}
              registrationCount={getRegistrationCount(e.id)}
              isAdmin={isAdmin || (isUnitLeader && e.created_by === currentUser?.email)}
              onEdit={(ev) => { setEditing(ev); setDialogOpen(true); }}
              onDelete={(ev) => { if (window.confirm(`Delete "${ev.title}"?`)) deleteMutation.mutate(ev.id); }}
              onManage={(ev) => setManagingEvent(ev)}
            />
          ))}
        </div>
      )}

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        onSave={handleSave}
        lockedCategory={isUnitLeader && myUnits[0] ? (unitCategoryMap[myUnits[0]] || "Other") : null}
      />

      <RegistrationsDialog
        open={!!managingEvent}
        onOpenChange={(v) => !v && setManagingEvent(null)}
        event={managingEvent}
      />
    </div>
  );
}