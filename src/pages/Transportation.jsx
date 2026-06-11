import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, MapPin, Clock, User, Plus, Loader2, CheckCircle, XCircle, Trash2, Edit, Settings, Search, Download, UserCheck, Phone, Mail, MessageSquare, Send, BellRing, CarFront, BarChart3 } from "lucide-react";
import TransportReportDialog from "@/components/transportation/TransportReportDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { useSubFeature } from "@/hooks/useSubFeature";
import PrintReportButton from "@/components/PrintReportButton";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import PasswordConfirmDialog from "@/components/shared/PasswordConfirmDialog";
import { normalizePhone } from "@/lib/phone-utils";

const statusColors = {
  "Pending": "bg-accent/10 text-accent",
  "Confirmed": "bg-chart-3/10 text-chart-3",
  "Notified": "bg-blue-500/10 text-blue-600",
  "Checked In": "bg-indigo-500/10 text-indigo-600",
  "Picked Up": "bg-purple-500/10 text-purple-600",
  "Completed": "bg-muted text-muted-foreground",
  "No-Show": "bg-orange-500/10 text-orange-600",
  "Cancelled": "bg-destructive/10 text-destructive",
};

const ALL_STATUSES = ["Pending", "Confirmed", "Notified", "Checked In", "Picked Up", "Completed", "No-Show", "Cancelled"];

const NEXT_STEP = {
  "Pending": { status: "Confirmed", label: "Confirm", icon: CheckCircle },
  "Confirmed": { status: "Notified", label: "Notify Passenger", icon: BellRing },
  "Notified": { status: "Checked In", label: "Mark Checked In", icon: UserCheck },
  "Checked In": { status: "Picked Up", label: "Mark Picked Up", icon: CarFront },
  "Picked Up": { status: "Completed", label: "Mark Completed", icon: CheckCircle },
};

const CHECKIN_STEPS = ["Confirmed", "Notified", "Checked In", "Picked Up", "Completed"];
const STEP_TIMESTAMP_KEY = {
  "Notified": "notified_at",
  "Checked In": "checked_in_at",
  "Picked Up": "picked_up_at",
};

export default function Transportation() {
  const { user, isAdmin, leaderUnits } = useAuth();
  const { isMemberOfUnit: isTransportUnit } = useUnitMembership("Transportation");
  const isLeader = isAdmin || leaderUnits.includes("Transportation");
  const canManage = isLeader; // Only leaders can manage bookings (approve/assign/edit/delete)
  const { enabled: canCreateBooking } = useSubFeature("transportation.create_booking");
  const queryClient = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterAssignee, setFilterAssignee] = useState("All");
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editLocationDialogOpen, setEditLocationDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [form, setForm] = useState({ pickup_address: "", destination: "Church", request_date: "", pickup_time: "", notes: "", passengers: 1, journey_type: "Single", return_date: "", return_time: "" });
  const [manageForm, setManageForm] = useState({ status: "", assigned_driver: "", driver_phone: "", driver_user_id: "", assigned_to: "" });
  const [locationForm, setLocationForm] = useState({ name: "", address: "", notes: "" });
  const [confirmDelete, setConfirmDelete] = useState(null); // { title, description, run }
  const [detailBooking, setDetailBooking] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["transportation", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase
        .from("transportation")
        .select("*, members(first_name, last_name, phone, email)")
        .order("request_date", { ascending: false }));
      if (error) throw error;
      return data;
    },
  });

  const { data: pickupLocations = [] } = useQuery({
    queryKey: ["pickup-locations", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("pickup_locations").select("*").eq("is_active", true).order("name"));
      if (error) throw error;
      return data;
    },
  });

  // Fetch Transportation unit members for assign-to dropdown
  const { data: transportMembers = [] } = useQuery({
    queryKey: ["transport-unit-members", tenantId],
    queryFn: async () => {
      // Get members who are in the Transportation unit
      const { data, error } = await scopeQuery(
        supabase.from("members")
          .select("id, user_id, first_name, last_name, phone")
          .ilike("church_unit", "%Transport%")
      );
      if (error) throw error;
      return (data || []).filter(m => m.user_id);
    },
  });

  // Build maps for display
  const assigneeMap = {};
  const assigneePhoneMap = {};
  transportMembers.forEach(m => {
    if (m.user_id) {
      assigneeMap[m.user_id] = `${m.first_name} ${m.last_name}`;
      assigneePhoneMap[m.user_id] = m.phone || "";
    }
  });

  // Role helpers per booking
  const isPassenger = (b) => b.user_id === user?.id;
  const isAssignee = (b) => b.assigned_to && b.assigned_to === user?.id;
  const isDriverUser = (b) => b.driver_user_id && b.driver_user_id === user?.id;
  // Unit members see all bookings but only act on their own assignments
  const canRunCheckin = (b) => isLeader || isAssignee(b) || isDriverUser(b);
  const canContactPassenger = (b) => canRunCheckin(b);
  const canAcknowledge = (b) =>
    isPassenger(b) && ["Confirmed", "Notified", "Checked In", "Picked Up", "Completed"].includes(b.status);

  // Visibility: leaders & unit members see all; otherwise own bookings + assignments + driver jobs
  const visibleBookings =
    isLeader || isTransportUnit
      ? bookings
      : bookings.filter(b => b.user_id === user?.id || b.assigned_to === user?.id || b.driver_user_id === user?.id);

  const filtered = visibleBookings.filter(b => {
    const name = b.members ? `${b.members.first_name} ${b.members.last_name}` : "";
    const matchSearch = `${name} ${b.pickup_address} ${b.destination || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || b.status === filterStatus;
    const matchDate = (!dateFrom || b.request_date >= dateFrom) && (!dateTo || b.request_date <= dateTo);
    const matchAssignee = filterAssignee === "All" || (filterAssignee === "Unassigned" ? !b.assigned_to : b.assigned_to === filterAssignee);
    return matchSearch && matchStatus && matchDate && matchAssignee;
  });


  const bookMutation = useMutation({
    mutationFn: async (formData) => {
      const { data: member } = await supabase.from("members").select("id").eq("user_id", user.id).eq("tenant_id", tenantId).single();
      const { error } = await supabase.from("transportation").insert(withTenant({
        pickup_address: formData.pickup_address,
        destination: formData.destination || "Church",
        request_date: formData.request_date,
        pickup_time: formData.pickup_time || null,
        notes: formData.notes || null,
        passengers: parseInt(formData.passengers) || 1,
        journey_type: formData.journey_type || "Single",
        return_date: formData.journey_type === "Round Trip" ? (formData.return_date || null) : null,
        return_time: formData.journey_type === "Round Trip" ? (formData.return_time || null) : null,
        user_id: user.id,
        member_id: member?.id || null,
      }));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      toast({ title: "Transport booked" });
      setBookDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const manageMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase.from("transportation").update(updates).eq("id", id).eq("tenant_id", tenantId)
        .select("*, members(first_name, last_name, phone, email)").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      toast({ title: "Booking updated" });
      setManageDialogOpen(false);
      const notifyStatuses = ["Confirmed", "Notified", "Checked In", "Picked Up", "Completed", "No-Show", "Cancelled"];
      if (data && notifyStatuses.includes(data.status)) {
        supabase.functions.invoke("notify-transport-booking", {
          body: {
            notification_type: "passenger_status",
            status: data.status,
            booking_id: data.id,
            member_id: data.member_id,
            member_name: data.members ? `${data.members.first_name} ${data.members.last_name}` : "Passenger",
            pickup: data.pickup_address,
            destination: data.destination || "Church",
            request_date: data.request_date,
            pickup_time: data.pickup_time,
            journey_type: data.journey_type,
            return_date: data.return_date,
            return_time: data.return_time,
            driver_name: data.assigned_driver,
            driver_phone: data.driver_phone,
            tenant_id: tenantId,
          },
        }).catch((err) => console.error("Passenger notify failed:", err));
      }
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Quick status update (used by check-in workflow; keeps detail panel open)
  const statusMutation = useMutation({
    mutationFn: async ({ id, status, extra = {} }) => {
      const { data, error } = await supabase.from("transportation")
        .update({ status, ...extra }).eq("id", id).eq("tenant_id", tenantId)
        .select("*, members(first_name, last_name, phone, email)").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      if (data) setDetailBooking(data);
      toast({ title: `Status updated to ${data?.status}` });
      // Auto-notify passenger (email + SMS + in-app) for passenger-relevant statuses
      const notifyStatuses = ["Confirmed", "Notified", "Checked In", "Picked Up", "Completed", "No-Show", "Cancelled"];
      if (data && notifyStatuses.includes(data.status)) {
        supabase.functions.invoke("notify-transport-booking", {
          body: {
            notification_type: "passenger_status",
            status: data.status,
            booking_id: data.id,
            member_id: data.member_id,
            member_name: data.members ? `${data.members.first_name} ${data.members.last_name}` : "Passenger",
            pickup: data.pickup_address,
            destination: data.destination || "Church",
            request_date: data.request_date,
            pickup_time: data.pickup_time,
            journey_type: data.journey_type,
            return_date: data.return_date,
            return_time: data.return_time,
            driver_name: data.assigned_driver,
            driver_phone: data.driver_phone,
            tenant_id: tenantId,
          },
        }).catch((err) => console.error("Auto passenger notify failed:", err));
      }
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Send a passenger notification (email + SMS) without changing status
  const notifyPassengerMutation = useMutation({
    mutationFn: async (booking) => {
      const { error } = await supabase.functions.invoke("notify-transport-booking", {
        body: {
          notification_type: "passenger_status",
          status: booking.status,
          booking_id: booking.id,
          member_id: booking.member_id,
          member_name: booking.members ? `${booking.members.first_name} ${booking.members.last_name}` : "Passenger",
          pickup: booking.pickup_address,
          destination: booking.destination || "Church",
          request_date: booking.request_date,
          pickup_time: booking.pickup_time,
          journey_type: booking.journey_type,
          return_date: booking.return_date,
          return_time: booking.return_time,
          driver_name: booking.assigned_driver,
          driver_phone: booking.driver_phone,
          tenant_id: tenantId,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Passenger notified" }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });


  const deleteBookingMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("transportation").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      toast({ title: "Booking deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveLocationMutation = useMutation({
    mutationFn: async (formData) => {
      if (editingLocation) {
        const { error } = await supabase.from("pickup_locations").update({ name: formData.name, address: formData.address, notes: formData.notes || null }).eq("id", editingLocation.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pickup_locations").insert(withTenant({ name: formData.name, address: formData.address, notes: formData.notes || null, created_by: user.id }));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup-locations"] });
      toast({ title: editingLocation ? "Location updated" : "Location added" });
      setEditLocationDialogOpen(false);
      setEditingLocation(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteLocationMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("pickup_locations").update({ is_active: false }).eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup-locations"] });
      toast({ title: "Location removed" });
    },
  });

  const openManage = (b) => {
    setSelectedBooking(b);
    setManageForm({ status: b.status, assigned_driver: b.assigned_driver || "", driver_phone: b.driver_phone || "", driver_user_id: b.driver_user_id || "", assigned_to: b.assigned_to || "" });
    setManageDialogOpen(true);
  };

  // Passenger acknowledgement
  const acknowledgeMutation = useMutation({
    mutationFn: async (id) => {
      const { data, error } = await supabase.from("transportation")
        .update({ passenger_acknowledged_at: new Date().toISOString() })
        .eq("id", id).eq("tenant_id", tenantId).eq("user_id", user.id)
        .select("*, members(first_name, last_name, phone, email)").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      if (data) setDetailBooking(data);
      toast({ title: "Acknowledged — thank you!" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openEditLocation = (loc) => {
    setEditingLocation(loc);
    setLocationForm({ name: loc.name, address: loc.address, notes: loc.notes || "" });
    setEditLocationDialogOpen(true);
  };

  const openNewLocation = () => {
    setEditingLocation(null);
    setLocationForm({ name: "", address: "", notes: "" });
    setEditLocationDialogOpen(true);
  };

  const downloadCSV = () => {
    const headers = ["Member", "Pickup", "Destination", "Date", "Time", "Passengers", "Status", "Assigned To", "Driver", "Driver Phone", "Notes"];
    const rows = filtered.map(b => [
      b.members ? `${b.members.first_name} ${b.members.last_name}` : "",
      b.pickup_address,
      b.destination || "Church",
      b.request_date,
      b.pickup_time || "",
      b.passengers || 1,
      b.status,
      b.assigned_to ? (assigneeMap[b.assigned_to] || "Assigned") : "",
      b.assigned_driver || "",
      b.driver_phone || "",
      b.notes || "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transportation-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-foreground">{filtered.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-accent">{filtered.filter(b => b.status === "Pending").length}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-chart-3">{filtered.filter(b => b.status === "Confirmed").length}</p><p className="text-xs text-muted-foreground">Confirmed</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-muted-foreground">{filtered.filter(b => b.status === "Completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-primary">{filtered.filter(b => b.assigned_to).length}</p><p className="text-xs text-muted-foreground">Assigned</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search bookings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button variant="outline" onClick={() => setLocationDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" /> Pickup Locations
              </Button>
            )}
            {canCreateBooking && (
              <Button onClick={() => { setForm({ pickup_address: "", destination: "Church", request_date: "", pickup_time: "", notes: "", passengers: 1, journey_type: "Single", return_date: "", return_time: "" }); setBookDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" /> Book Transport
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-auto">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="w-full sm:w-auto">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="w-full sm:w-auto">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {canManage && (
            <div className="w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground">Assigned To</Label>
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Unassigned">Unassigned</SelectItem>
                  {transportMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isLeader && (
            <>
              <Button variant="outline" onClick={() => setReportOpen(true)} disabled={filtered.length === 0}>
                <BarChart3 className="h-4 w-4 mr-2" /> Report
              </Button>
              <Button variant="outline" onClick={downloadCSV} disabled={filtered.length === 0}>
                <Download className="h-4 w-4 mr-2" /> CSV
              </Button>
              <PrintReportButton label="Print" buildRows={() => ({
                title: "Transportation Report",
                headers: ["Member", "Pickup", "Destination", "Date", "Time", "Passengers", "Status", "Assigned To", "Driver", "Notes"],
                rows: filtered.map(b => [
                  b.members ? `${b.members.first_name} ${b.members.last_name}` : "",
                  b.pickup_address,
                  b.destination || "Church",
                  b.request_date,
                  b.pickup_time || "",
                  b.passengers || 1,
                  b.status,
                  b.assigned_to ? (assigneeMap[b.assigned_to] || "Assigned") : "",
                  b.assigned_driver || "",
                  b.notes || "",
                ]),
              })} />
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm p-12 text-center text-muted-foreground">
          <Car className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No bookings found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => (
            <Card key={b.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailBooking(b)}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Car className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-foreground">
                        {b.members ? `${b.members.first_name} ${b.members.last_name}` : "Member"}
                      </h3>
                      <Badge className={`border-0 ${statusColors[b.status] || ""}`}>{b.status}</Badge>
                      {b.journey_type === "Round Trip" && <Badge variant="outline" className="text-xs">Round Trip</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {b.pickup_address} → {b.destination || "Church"}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {b.request_date}{b.pickup_time ? ` · ${b.pickup_time}` : ""}</span>
                      {b.assigned_to && assigneeMap[b.assigned_to] && (
                        <span className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-primary" /> {assigneeMap[b.assigned_to]}</span>
                      )}
                      {b.assigned_driver && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {b.assigned_driver}</span>}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openManage(b); }}>Manage</Button>
                      <Button variant="ghost" size="icon" onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete({
                          title: "Delete booking",
                          description: "This will permanently delete the transport booking.",
                          run: () => deleteBookingMutation.mutate(b.id),
                        });
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Booking Detail Dialog */}
      <Dialog open={!!detailBooking} onOpenChange={(v) => !v && setDetailBooking(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {detailBooking?.members ? `${detailBooking.members.first_name} ${detailBooking.members.last_name}` : "Booking Details"}
            </DialogTitle>
          </DialogHeader>
          {detailBooking && (() => {
            const passengerName = detailBooking.members ? `${detailBooking.members.first_name} ${detailBooking.members.last_name}` : "Passenger";
            const passengerPhone = detailBooking.members?.phone || "";
            const passengerEmail = detailBooking.members?.email || "";
            const e164 = normalizePhone(passengerPhone);
            const waNumber = e164 ? e164.replace(/^\+/, "") : "";
            const smsBody = `Hi ${detailBooking.members?.first_name || "there"}, this is the church transport team about your ${detailBooking.pickup_time || ""} pickup from ${detailBooking.pickup_address}.`;
            const next = NEXT_STEP[detailBooking.status];
            const terminal = ["Completed", "Cancelled", "No-Show"].includes(detailBooking.status);
            const currentStepIdx = CHECKIN_STEPS.indexOf(detailBooking.status);
            return (
              <div className="space-y-4 text-sm">
                <Badge className={`border-0 ${statusColors[detailBooking.status] || ""}`}>{detailBooking.status}</Badge>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{detailBooking.pickup_address} → {detailBooking.destination || "Church"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{detailBooking.request_date}{detailBooking.pickup_time ? ` · ${detailBooking.pickup_time}` : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {detailBooking.journey_type === "Round Trip" ? "Round Trip" : "Single Trip"}
                    </Badge>
                    {detailBooking.journey_type === "Round Trip" && (detailBooking.return_date || detailBooking.return_time) && (
                      <span className="text-xs">Return: {detailBooking.return_date || ""}{detailBooking.return_time ? ` · ${detailBooking.return_time}` : ""}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{detailBooking.passengers || 1} passenger{(detailBooking.passengers || 1) > 1 ? "s" : ""}</span>
                  </div>
                  {detailBooking.assigned_to && assigneeMap[detailBooking.assigned_to] && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <UserCheck className="h-4 w-4" />
                      <span>
                        Assigned to {assigneeMap[detailBooking.assigned_to]}
                        {assigneePhoneMap[detailBooking.assigned_to] ? ` · ${assigneePhoneMap[detailBooking.assigned_to]}` : ""}
                      </span>
                    </div>
                  )}
                  {detailBooking.assigned_driver && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car className="h-4 w-4" />
                      <span>Driver: {detailBooking.assigned_driver}{detailBooking.driver_phone ? ` · ${detailBooking.driver_phone}` : ""}</span>
                    </div>
                  )}
                  {detailBooking.notes && (
                    <div>
                      <p className="font-medium text-foreground mb-1">Notes</p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{detailBooking.notes}</p>
                    </div>
                  )}
                </div>

                {(canRunCheckin(detailBooking) || isPassenger(detailBooking)) && (
                  <div className="rounded-lg border border-border p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Check-In Workflow{!canRunCheckin(detailBooking) && isPassenger(detailBooking) ? " (read-only)" : ""}
                    </p>
                    <ol className="flex items-center justify-between gap-1">
                      {CHECKIN_STEPS.map((step, idx) => {
                        const done = currentStepIdx >= idx && currentStepIdx !== -1;
                        const active = currentStepIdx === idx;
                        const ts = STEP_TIMESTAMP_KEY[step] ? detailBooking[STEP_TIMESTAMP_KEY[step]] : null;
                        return (
                          <li key={step} className="flex-1 text-center">
                            <div className={`mx-auto h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} ${active ? "ring-2 ring-primary/40" : ""}`}>
                              {idx + 1}
                            </div>
                            <p className={`mt-1 text-[10px] leading-tight ${done ? "text-foreground" : "text-muted-foreground"}`}>{step}</p>
                            {ts && <p className="text-[9px] text-muted-foreground">{new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
                          </li>
                        );
                      })}
                    </ol>
                    {canRunCheckin(detailBooking) && !terminal && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {next && (
                          <Button size="sm" onClick={() => statusMutation.mutate({ id: detailBooking.id, status: next.status })} disabled={statusMutation.isPending} className="bg-primary">
                            <next.icon className="h-3.5 w-3.5 mr-1" /> {next.label}
                          </Button>
                        )}
                        {["Notified", "Checked In", "Confirmed"].includes(detailBooking.status) && (
                          <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50"
                            onClick={() => statusMutation.mutate({ id: detailBooking.id, status: "No-Show" })} disabled={statusMutation.isPending}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> No-Show
                          </Button>
                        )}
                        {isLeader && (
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5"
                            onClick={() => statusMutation.mutate({ id: detailBooking.id, status: "Cancelled" })} disabled={statusMutation.isPending}>
                            Cancel Booking
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Passenger acknowledgement */}
                {isPassenger(detailBooking) && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Booking</p>
                    {detailBooking.passenger_acknowledged_at ? (
                      <p className="text-sm text-chart-3 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Acknowledged on {new Date(detailBooking.passenger_acknowledged_at).toLocaleString()}
                      </p>
                    ) : canAcknowledge(detailBooking) ? (
                      <>
                        <p className="text-xs text-muted-foreground">Please confirm you've received this update from the Transport team.</p>
                        <Button size="sm" onClick={() => acknowledgeMutation.mutate(detailBooking.id)} disabled={acknowledgeMutation.isPending} className="bg-primary">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Acknowledge
                        </Button>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Your booking is awaiting team review.</p>
                    )}
                  </div>
                )}

                {canContactPassenger(detailBooking) && (passengerPhone || passengerEmail) && (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact {passengerName}</p>
                    <div className="flex flex-wrap gap-2">
                      {passengerPhone && (
                        <a href={`tel:${passengerPhone}`}>
                          <Button size="sm" variant="outline"><Phone className="h-3.5 w-3.5 mr-1" /> Call</Button>
                        </a>
                      )}
                      {passengerPhone && (
                        <a href={`sms:${passengerPhone}?body=${encodeURIComponent(smsBody)}`}>
                          <Button size="sm" variant="outline"><MessageSquare className="h-3.5 w-3.5 mr-1" /> SMS</Button>
                        </a>
                      )}
                      {waNumber && (
                        <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(smsBody)}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50">
                            <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                          </Button>
                        </a>
                      )}
                      {passengerEmail && (
                        <a href={`mailto:${passengerEmail}`}>
                          <Button size="sm" variant="outline"><Mail className="h-3.5 w-3.5 mr-1" /> Email</Button>
                        </a>
                      )}
                      <Button size="sm" variant="outline" onClick={() => notifyPassengerMutation.mutate(detailBooking)} disabled={notifyPassengerMutation.isPending} className="text-primary border-primary/30 hover:bg-primary/5">
                        <Send className="h-3.5 w-3.5 mr-1" /> Send Notification
                      </Button>
                    </div>
                    {(passengerPhone || passengerEmail) && (
                      <p className="text-[11px] text-muted-foreground">
                        {passengerPhone && <span>{passengerPhone}</span>}
                        {passengerPhone && passengerEmail && <span> · </span>}
                        {passengerEmail && <span>{passengerEmail}</span>}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Book Transport Dialog */}
      <Dialog open={bookDialogOpen} onOpenChange={setBookDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Book Transport</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Pickup Location</Label>
              {pickupLocations.length > 0 ? (
                <Select value={form.pickup_address} onValueChange={v => setForm(f => ({ ...f, pickup_address: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select or type below" /></SelectTrigger>
                  <SelectContent>
                    {pickupLocations.map(l => <SelectItem key={l.id} value={l.address}>{l.name} – {l.address}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}
              <Input value={form.pickup_address} onChange={e => setForm(f => ({ ...f, pickup_address: e.target.value }))} placeholder="Or type custom address" className="mt-2" />
            </div>
            <div><Label>Destination</Label><Input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.request_date} onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} /></div>
              <div><Label>Pickup Time</Label><Input type="time" value={form.pickup_time} onChange={e => setForm(f => ({ ...f, pickup_time: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Journey Type</Label>
              <Select value={form.journey_type} onValueChange={v => setForm(f => ({ ...f, journey_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single Trip (one-way)</SelectItem>
                  <SelectItem value="Round Trip">Round Trip (return pickup)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.journey_type === "Round Trip" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Return Date</Label><Input type="date" value={form.return_date} onChange={e => setForm(f => ({ ...f, return_date: e.target.value }))} /></div>
                <div><Label>Return Pickup Time</Label><Input type="time" value={form.return_time} onChange={e => setForm(f => ({ ...f, return_time: e.target.value }))} /></div>
              </div>
            )}
            <div><Label>Passengers</Label><Input type="number" min="1" value={form.passengers} onChange={e => setForm(f => ({ ...f, passengers: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={() => bookMutation.mutate(form)} disabled={bookMutation.isPending || !form.pickup_address || !form.request_date} className="w-full bg-primary">
              {bookMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Book Transport
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Booking Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Manage Booking</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Status</Label>
              <Select value={manageForm.status} onValueChange={v => setManageForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assign To</Label>
              <Select value={manageForm.assigned_to || "none"} onValueChange={v => setManageForm(f => ({ ...f, assigned_to: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {transportMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Driver (Transport Unit)</Label>
              <Select
                value={manageForm.driver_user_id || "manual"}
                onValueChange={v => {
                  if (v === "manual") {
                    setManageForm(f => ({ ...f, driver_user_id: "", assigned_driver: "", driver_phone: "" }));
                  } else {
                    const m = transportMembers.find(x => x.user_id === v);
                    if (m) setManageForm(f => ({ ...f, driver_user_id: m.user_id, assigned_driver: `${m.first_name} ${m.last_name}`, driver_phone: m.phone || "" }));
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select a unit member or enter manually" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">— Enter manually below —</SelectItem>
                  {transportMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.first_name} {m.last_name}{m.phone ? ` · ${m.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">Pick a Transport unit member to auto-fill, or type a name and phone below.</p>
            </div>
            <div><Label>Driver Name</Label><Input value={manageForm.assigned_driver} onChange={e => setManageForm(f => ({ ...f, assigned_driver: e.target.value, driver_user_id: "" }))} placeholder="Driver name" /></div>
            <div><Label>Driver Phone</Label><Input value={manageForm.driver_phone} onChange={e => setManageForm(f => ({ ...f, driver_phone: e.target.value }))} placeholder="Phone number" /></div>
            <div className="flex gap-2">
              <Button onClick={() => manageMutation.mutate({ id: selectedBooking.id, updates: { status: "Confirmed", assigned_driver: manageForm.assigned_driver, driver_phone: manageForm.driver_phone, driver_user_id: manageForm.driver_user_id || null, assigned_to: manageForm.assigned_to || null } })} className="flex-1 bg-chart-3 hover:bg-chart-3/90">
                <CheckCircle className="h-4 w-4 mr-2" /> Approve
              </Button>
              <Button variant="destructive" onClick={() => manageMutation.mutate({ id: selectedBooking.id, updates: { status: "Cancelled" } })} className="flex-1">
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
            </div>
            <Button variant="outline" onClick={() => manageMutation.mutate({ id: selectedBooking.id, updates: { ...manageForm, driver_user_id: manageForm.driver_user_id || null, assigned_to: manageForm.assigned_to || null } })} disabled={manageMutation.isPending} className="w-full">
              {manageMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pickup Locations Management Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Pickup Locations</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2 max-h-80 overflow-y-auto">
            {pickupLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pickup locations configured</p>
            ) : pickupLocations.map(loc => (
              <div key={loc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">{loc.name}</p>
                  <p className="text-xs text-muted-foreground">{loc.address}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEditLocation(loc)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setConfirmDelete({
                    title: "Remove location",
                    description: "This will remove the pickup location from your list.",
                    run: () => deleteLocationMutation.mutate(loc.id),
                  })}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={openNewLocation} className="w-full bg-primary">
            <Plus className="h-4 w-4 mr-2" /> Add Location
          </Button>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Location Dialog */}
      <Dialog open={editLocationDialogOpen} onOpenChange={setEditLocationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editingLocation ? "Edit Location" : "Add Location"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Name</Label><Input value={locationForm.name} onChange={e => setLocationForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Canton Bus Stop" /></div>
            <div><Label>Address</Label><Input value={locationForm.address} onChange={e => setLocationForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" /></div>
            <div><Label>Notes</Label><Textarea value={locationForm.notes} onChange={e => setLocationForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={() => saveLocationMutation.mutate(locationForm)} disabled={saveLocationMutation.isPending || !locationForm.name || !locationForm.address} className="w-full bg-primary">
              {saveLocationMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingLocation ? "Save Changes" : "Add Location"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PasswordConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}
        title={confirmDelete?.title || "Confirm delete"}
        description={confirmDelete?.description}
        isPending={deleteBookingMutation.isPending || deleteLocationMutation.isPending}
        onConfirm={() => confirmDelete?.run?.()}
      />
      <TransportReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        bookings={filtered}
        assigneeMap={assigneeMap}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  );
}
