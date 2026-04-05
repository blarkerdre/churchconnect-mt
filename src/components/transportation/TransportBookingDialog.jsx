import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const empty = {
  member_name: "",
  contact_phone: "",
  pickup_address: "",
  destination: "",
  date: "",
  time: "",
  passengers: 1,
  trip_type: "Sunday Service",
  status: "Pending",
  driver_name: "",
  vehicle: "",
  notes: "",
};

export default function TransportBookingDialog({ open, onOpenChange, booking, onSave, myMember, isTransportUnit = false }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (booking) {
      setForm({ ...empty, ...booking });
    } else {
      setForm({
        ...empty,
        member_name: myMember ? `${myMember.first_name} ${myMember.last_name}` : "",
        contact_phone: myMember?.phone || "",
        member_id: myMember?.id || "",
      });
    }
  }, [booking, open, myMember]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onOpenChange(false); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>{booking ? "Edit Booking" : "New Transport Booking"}</TenantDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Passenger Name *</Label>
              <Input required value={form.member_name} onChange={e => set("member_name", e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label>Contact Phone</Label>
              <Input value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} placeholder="+44..." />
            </div>
            <div className="space-y-1">
              <Label>Passengers</Label>
              <Input type="number" min="1" max="20" value={form.passengers} onChange={e => set("passengers", Number(e.target.value))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Pickup Address *</Label>
              <Input required value={form.pickup_address} onChange={e => set("pickup_address", e.target.value)} placeholder="Full pickup address" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Destination *</Label>
              <Input required value={form.destination} onChange={e => set("destination", e.target.value)} placeholder="Destination address" />
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input required type="date" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Pickup Time *</Label>
              <Input required type="time" value={form.time} onChange={e => set("time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Trip Type</Label>
              <Select value={form.trip_type} onValueChange={v => set("trip_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Sunday Service", "Midweek Service", "Special Event", "Airport Transfer", "Hospital Visit", "Other"].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isTransportUnit && (
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Pending", "Confirmed", "In Transit", "Completed", "Cancelled"].map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isTransportUnit && (
              <div className="space-y-1">
                <Label>Assigned Driver</Label>
                <Input value={form.driver_name} onChange={e => set("driver_name", e.target.value)} placeholder="Driver name" />
              </div>
            )}
            {isTransportUnit && (
              <div className="space-y-1">
                <Label>Vehicle</Label>
                <Input value={form.vehicle} onChange={e => set("vehicle", e.target.value)} placeholder="e.g. Silver Toyota Hiace" />
              </div>
            )}
            <div className="col-span-2 space-y-1">
              <Label>Notes / Special Requirements</Label>
              <Textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
              {saving ? "Saving..." : booking ? "Update Booking" : "Create Booking"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}