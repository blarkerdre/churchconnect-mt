import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

export default function DriverAvailabilityDialog({
  open,
  onOpenChange,
  tenantId,
  user,
  driverUnit,
  serviceTypes = [],
  onSaved,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberId, setMemberId] = useState(null);
  const [form, setForm] = useState({
    available_date: "",
    service_type: "",
    pickup_area_address: "",
    pickup_area_postcode: "",
    seats_available: 3,
    notes: "",
  });

  // Prefill address from member record
  useEffect(() => {
    if (!open || !user?.id || !tenantId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("members")
        .select("id, address, postcode")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (cancelled) return;
      setMemberId(data?.id || null);
      setForm((f) => ({
        ...f,
        pickup_area_address: f.pickup_area_address || data?.address || "",
        pickup_area_postcode: f.pickup_area_postcode || data?.postcode || "",
      }));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, user?.id, tenantId]);

  const handleSubmit = async () => {
    if (!form.available_date || !form.pickup_area_address || !form.seats_available) {
      toast({ title: "Missing fields", description: "Date, address, and seats are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: row, error } = await supabase
        .from("driver_availability")
        .insert({
          tenant_id: tenantId,
          driver_user_id: user.id,
          driver_member_id: memberId,
          driver_unit: driverUnit || "Transportation",
          available_date: form.available_date,
          service_type: form.service_type || null,
          pickup_area_address: form.pickup_area_address,
          pickup_area_postcode: form.pickup_area_postcode || null,
          seats_available: Number(form.seats_available) || 1,
          notes: form.notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Look up leader user ids for Transportation + Kingdom Chariot in this tenant
      const { data: leaders } = await supabase
        .from("unit_leader_assignments")
        .select("user_id, unit_name")
        .eq("tenant_id", tenantId)
        .in("unit_name", ["Transportation", "Kingdom Chariot"]);
      const leaderUserIds = Array.from(new Set((leaders || []).map((l) => l.user_id))).filter(Boolean);

      if (leaderUserIds.length > 0) {
        const { data: profile } = await supabase
          .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        await supabase.functions.invoke("notify-transport-booking", {
          body: {
            notification_type: "driver_availability",
            tenant_id: tenantId,
            availability_id: row.id,
            driver_name: profile?.full_name || "A driver",
            driver_unit: driverUnit || "Transportation",
            available_date: form.available_date,
            service_type: form.service_type || "",
            pickup_area: `${form.pickup_area_address}${form.pickup_area_postcode ? ` [${form.pickup_area_postcode}]` : ""}`,
            seats: Number(form.seats_available) || 1,
            notes: form.notes || "",
            leader_user_ids: leaderUserIds,
          },
        });
      }

      toast({ title: "Availability submitted", description: "Unit leaders have been notified." });
      onSaved?.();
      onOpenChange(false);
      setForm({ available_date: "", service_type: "", pickup_area_address: "", pickup_area_postcode: "", seats_available: 3, notes: "" });
    } catch (e) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Mark Driving Availability</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">
              This will notify Transportation and Kingdom Chariot unit leaders that you are available to pick passengers.
            </p>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.available_date}
                onChange={(e) => setForm((f) => ({ ...f, available_date: e.target.value }))} />
            </div>
            <div>
              <Label>Service to attend</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm((f) => ({ ...f, service_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pickup area / your address *</Label>
              <Textarea rows={2} value={form.pickup_area_address}
                onChange={(e) => setForm((f) => ({ ...f, pickup_area_address: e.target.value }))}
                placeholder="Where you are leaving from" />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input value={form.pickup_area_postcode}
                onChange={(e) => setForm((f) => ({ ...f, pickup_area_postcode: e.target.value.toUpperCase() }))}
                placeholder="e.g. CF10 1AA" />
            </div>
            <div>
              <Label>Seats available *</Label>
              <Input type="number" min={1} max={20} value={form.seats_available}
                onChange={(e) => setForm((f) => ({ ...f, seats_available: e.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anything leaders should know (e.g. preferred areas)" />
            </div>
            <Button onClick={handleSubmit} disabled={saving} className="w-full bg-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Submit & Notify Leaders
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
