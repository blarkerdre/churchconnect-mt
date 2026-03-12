import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/components/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Car, Clock, MapPin, User, CheckCircle2, Loader2, Bus } from "lucide-react";
import TransportBookingDialog from "@/components/transportation/TransportBookingDialog";
import TransportDetailPanel from "@/components/transportation/TransportDetailPanel";

const statusColors = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  "In Transit": "bg-purple-50 text-purple-700 border-purple-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function Transportation() {
  const { user, isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);

  const { data: myMemberArr = [] } = useQuery({
    queryKey: ["my-member-transport", user?.email],
    queryFn: () => base44.entities.Member.filter({ email: user.email }),
    enabled: !!user?.email,
  });
  const myMember = myMemberArr[0] || null;
  const isTransportUnit = isAdmin || (myMember?.church_units || []).includes("Transportation");

  // Transport unit members/admins see all bookings; regular members see only their own
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["transportation", isTransportUnit, user?.email],
    queryFn: () => isTransportUnit
      ? base44.entities.Transportation.list("-created_date", 200)
      : base44.entities.Transportation.filter({ member_name: myMember ? `${myMember.first_name} ${myMember.last_name}` : "" }, "-created_date", 50),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.Transportation.create(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transportation"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, prevStatus }) => {
      await base44.entities.Transportation.update(id, data);
      // Send email notification if status changed to Confirmed or Cancelled
      if (data.status && data.status !== prevStatus && ["Confirmed", "Cancelled"].includes(data.status)) {
        await base44.functions.invoke("notifyTransportStatus", { booking_id: id, new_status: data.status });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transportation"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Transportation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      setSelected(null);
    },
  });

  const handleSave = async (data) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data, prevStatus: editing.status });
    } else {
      await createMutation.mutateAsync(data);
    }
    setEditing(null);
  };

  const filtered = bookings.filter((b) => {
    const matchSearch = `${b.member_name} ${b.pickup_address} ${b.destination} ${b.driver_name || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === "Pending").length,
    confirmed: bookings.filter(b => b.status === "Confirmed").length,
    completed: bookings.filter(b => b.status === "Completed").length,
  };

  // All members can access transportation (to book for themselves)

  return (
    <div className="space-y-6">
      {/* Member notice */}
      {!isTransportUnit && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          You can book transportation requests below. The Transportation team will review and confirm your booking.
        </div>
      )}

      {/* Stats — only for transport unit */}
      {isTransportUnit ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Bookings", value: stats.total, color: "text-slate-700" },
            { label: "Pending", value: stats.pending, color: "text-amber-600" },
            { label: "Confirmed", value: stats.confirmed, color: "text-blue-600" },
            { label: "Completed", value: stats.completed, color: "text-emerald-600" },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2 flex-1 flex-wrap">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search bookings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {["Pending", "Confirmed", "In Transit", "Completed", "Cancelled"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
          <Plus className="h-4 w-4 mr-2" /> New Booking
        </Button>
      </div>

      {/* Main content */}
      <div className={`flex gap-4 ${selected ? "flex-col lg:flex-row" : ""}`}>
        <Card className={`border-0 shadow-sm overflow-hidden ${selected ? "flex-1" : "w-full"}`}>
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading bookings...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Car className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No bookings found</p>
              <p className="text-sm text-slate-400 mt-1">Create a new booking to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map(b => (
                <div
                  key={b.id}
                  onClick={() => setSelected(b.id === selected?.id ? null : b)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selected?.id === b.id ? "bg-blue-50/50 border-l-4 border-[#1e3a5f]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <Car className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 text-sm">{b.member_name}</p>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{b.pickup_address} → {b.destination}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{b.date} {b.time}</span>
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{b.passengers} pax</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="secondary" className={`text-xs border ${statusColors[b.status]}`}>{b.status}</Badge>
                      <span className="text-xs text-slate-400">{b.trip_type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {selected && (
          <div className="w-full lg:w-96 shrink-0">
            <TransportDetailPanel
              booking={bookings.find(b => b.id === selected.id) || selected}
              onClose={() => setSelected(null)}
              onEdit={(b) => { setEditing(b); setDialogOpen(true); }}
              onDelete={(b) => { if (window.confirm("Delete this booking?")) deleteMutation.mutate(b.id); }}
              onUpdateStatus={(id, status) => {
                const booking = bookings.find(b => b.id === id);
                updateMutation.mutate({ id, data: { status }, prevStatus: booking?.status });
              }}
              canAction={isTransportUnit}
            />
          </div>
        )}
      </div>

      <TransportBookingDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
        booking={editing}
        onSave={handleSave}
        currentUser={user}
        myMember={myMember}
        isTransportUnit={isTransportUnit}
      />
    </div>
  );
}