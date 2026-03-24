import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, MapPin, Clock, User, Plus, Loader2, CheckCircle, XCircle, Trash2, Edit, Settings, Search, Download } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { useSubFeature } from "@/hooks/useSubFeature";
import PrintReportButton from "@/components/PrintReportButton";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const statusColors = {
  "Confirmed": "bg-chart-3/10 text-chart-3",
  "Pending": "bg-accent/10 text-accent",
  "Completed": "bg-muted text-muted-foreground",
  "Cancelled": "bg-destructive/10 text-destructive",
};

const ALL_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];

export default function Transportation() {
  const { user, isAdmin, leaderUnits } = useAuth();
  const { isMemberOfUnit: isTransportUnit } = useUnitMembership("Transportation");
  const canManage = isAdmin || leaderUnits.includes("Transportation") || isTransportUnit;
  const { enabled: canCreateBooking } = useSubFeature("transportation.create_booking");
  const queryClient = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editLocationDialogOpen, setEditLocationDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [form, setForm] = useState({ pickup_address: "", destination: "Church", request_date: "", pickup_time: "", notes: "", passengers: 1 });
  const [manageForm, setManageForm] = useState({ status: "", assigned_driver: "", driver_phone: "" });
  const [locationForm, setLocationForm] = useState({ name: "", address: "", notes: "" });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["transportation", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase
        .from("transportation")
        .select("*, members(first_name, last_name)")
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

  const visibleBookings = canManage ? bookings : bookings.filter(b => b.user_id === user?.id);

  const filtered = visibleBookings.filter(b => {
    const name = b.members ? `${b.members.first_name} ${b.members.last_name}` : "";
    const matchSearch = `${name} ${b.pickup_address} ${b.destination || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || b.status === filterStatus;
    const matchDate = (!dateFrom || b.request_date >= dateFrom) && (!dateTo || b.request_date <= dateTo);
    return matchSearch && matchStatus && matchDate;
  });

  const bookMutation = useMutation({
    mutationFn: async (formData) => {
      const { data: member } = await supabase.from("members").select("id").eq("user_id", user.id).single();
      const { error } = await supabase.from("transportation").insert(withTenant({
        pickup_address: formData.pickup_address,
        destination: formData.destination || "Church",
        request_date: formData.request_date,
        pickup_time: formData.pickup_time || null,
        notes: formData.notes || null,
        passengers: parseInt(formData.passengers) || 1,
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
      const { error } = await supabase.from("transportation").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      toast({ title: "Booking updated" });
      setManageDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("transportation").delete().eq("id", id);
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
        const { error } = await supabase.from("pickup_locations").update({ name: formData.name, address: formData.address, notes: formData.notes || null }).eq("id", editingLocation.id);
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
      const { error } = await supabase.from("pickup_locations").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickup-locations"] });
      toast({ title: "Location removed" });
    },
  });

  const openManage = (b) => {
    setSelectedBooking(b);
    setManageForm({ status: b.status, assigned_driver: b.assigned_driver || "", driver_phone: b.driver_phone || "" });
    setManageDialogOpen(true);
  };

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
    const headers = ["Member", "Pickup", "Destination", "Date", "Time", "Passengers", "Status", "Driver", "Driver Phone", "Notes"];
    const rows = filtered.map(b => [
      b.members ? `${b.members.first_name} ${b.members.last_name}` : "",
      b.pickup_address,
      b.destination || "Church",
      b.request_date,
      b.pickup_time || "",
      b.passengers || 1,
      b.status,
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-foreground">{filtered.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-accent">{filtered.filter(b => b.status === "Pending").length}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-chart-3">{filtered.filter(b => b.status === "Confirmed").length}</p><p className="text-xs text-muted-foreground">Confirmed</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-3 sm:p-4 text-center"><p className="text-xl sm:text-2xl font-display font-bold text-muted-foreground">{filtered.filter(b => b.status === "Completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
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
              <Button onClick={() => { setForm({ pickup_address: "", destination: "Church", request_date: "", pickup_time: "", notes: "", passengers: 1 }); setBookDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
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
          <Button variant="outline" onClick={downloadCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
          <PrintReportButton label="Print" buildRows={() => ({
            title: "Transportation Report",
            headers: ["Member", "Pickup", "Destination", "Date", "Time", "Passengers", "Status", "Driver", "Driver Phone", "Notes"],
            rows: filtered.map(b => [
              b.members ? `${b.members.first_name} ${b.members.last_name}` : "",
              b.pickup_address,
              b.destination || "Church",
              b.request_date,
              b.pickup_time || "",
              b.passengers || 1,
              b.status,
              b.assigned_driver || "",
              b.driver_phone || "",
              b.notes || "",
            ]),
          })} />
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
            <Card key={b.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
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
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {b.pickup_address} → {b.destination || "Church"}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {b.request_date}{b.pickup_time ? ` · ${b.pickup_time}` : ""}</span>
                      {b.assigned_driver && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {b.assigned_driver}</span>}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => openManage(b)}>Manage</Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (window.confirm("Delete this booking?")) deleteBookingMutation.mutate(b.id);
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
            <div><Label>Assigned Driver</Label><Input value={manageForm.assigned_driver} onChange={e => setManageForm(f => ({ ...f, assigned_driver: e.target.value }))} placeholder="Driver name" /></div>
            <div><Label>Driver Phone</Label><Input value={manageForm.driver_phone} onChange={e => setManageForm(f => ({ ...f, driver_phone: e.target.value }))} placeholder="Phone number" /></div>
            <div className="flex gap-2">
              <Button onClick={() => manageMutation.mutate({ id: selectedBooking.id, updates: { status: "Confirmed", assigned_driver: manageForm.assigned_driver, driver_phone: manageForm.driver_phone } })} className="flex-1 bg-chart-3 hover:bg-chart-3/90">
                <CheckCircle className="h-4 w-4 mr-2" /> Approve
              </Button>
              <Button variant="destructive" onClick={() => manageMutation.mutate({ id: selectedBooking.id, updates: { status: "Cancelled" } })} className="flex-1">
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
            </div>
            <Button variant="outline" onClick={() => manageMutation.mutate({ id: selectedBooking.id, updates: manageForm })} disabled={manageMutation.isPending} className="w-full">
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
                  <Button variant="ghost" size="icon" onClick={() => {
                    if (window.confirm("Remove this location?")) deleteLocationMutation.mutate(loc.id);
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
    </div>
  );
}
