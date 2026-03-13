import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, MapPin, Clock, User, Plus, Loader2, CheckCircle, XCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnitMembership } from "@/hooks/useUnitMembership";

const statusColors = {
  "Confirmed": "bg-chart-3/10 text-chart-3",
  "Pending": "bg-accent/10 text-accent",
  "Completed": "bg-muted text-muted-foreground",
  "Cancelled": "bg-destructive/10 text-destructive",
};

export default function Transportation() {
  const { user, isAdmin } = useAuth();
  const { isMemberOfUnit: isTransportUnit } = useUnitMembership("Transportation");
  const canManage = isAdmin || isTransportUnit;
  const queryClient = useQueryClient();
  const [bookDialogOpen, setBookDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [form, setForm] = useState({ pickup_address: "", destination: "Church", request_date: "", pickup_time: "", notes: "", passengers: 1 });
  const [manageForm, setManageForm] = useState({ status: "", assigned_driver: "", driver_phone: "" });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["transportation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transportation")
        .select("*, members(first_name, last_name)")
        .order("request_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Non-managers only see their own bookings
  const visibleBookings = canManage ? bookings : bookings.filter(b => b.user_id === user?.id);

  const bookMutation = useMutation({
    mutationFn: async (formData) => {
      // Get member record for current user
      const { data: member } = await supabase.from("members").select("id").eq("user_id", user.id).single();
      const { error } = await supabase.from("transportation").insert({
        pickup_address: formData.pickup_address,
        destination: formData.destination || "Church",
        request_date: formData.request_date,
        pickup_time: formData.pickup_time || null,
        notes: formData.notes || null,
        passengers: parseInt(formData.passengers) || 1,
        user_id: user.id,
        member_id: member?.id || null,
      });
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

  const openManage = (b) => {
    setSelectedBooking(b);
    setManageForm({ status: b.status, assigned_driver: b.assigned_driver || "", driver_phone: b.driver_phone || "" });
    setManageDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{visibleBookings.length}</p><p className="text-xs text-muted-foreground">Total Bookings</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{visibleBookings.filter(b => b.status === "Pending").length}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{visibleBookings.filter(b => b.status === "Confirmed").length}</p><p className="text-xs text-muted-foreground">Confirmed</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-muted-foreground">{visibleBookings.filter(b => b.status === "Completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => { setForm({ pickup_address: "", destination: "Church", request_date: "", pickup_time: "", notes: "", passengers: 1 }); setBookDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> Book Transport
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : visibleBookings.length === 0 ? (
        <Card className="border-0 shadow-sm p-12 text-center text-muted-foreground">
          <Car className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No bookings found</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleBookings.map(b => (
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
                  {canManage && b.status === "Pending" && (
                    <Button variant="outline" size="sm" onClick={() => openManage(b)}>Manage</Button>
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
            <div><Label>Pickup Address</Label><Input value={form.pickup_address} onChange={e => setForm(f => ({ ...f, pickup_address: e.target.value }))} placeholder="e.g. Canton, Cardiff" /></div>
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
                  {["Pending", "Confirmed", "Completed", "Cancelled"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
    </div>
  );
}
