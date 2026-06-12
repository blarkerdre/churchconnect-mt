import React, { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GripVertical, MapPin, Clock, Phone, ArrowUp, ArrowDown, Loader2, Route, Bell, CheckCircle, Printer, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
import { useQueryClient } from "@tanstack/react-query";

export default function RoutePlannerDialog({ open, onOpenChange, bookings, transportMembers, tenantId, currentUserId, isLeader = false, availabilityEntries = [] }) {
  const today = new Date().toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [driverId, setDriverId] = useState("");
  const [order, setOrder] = useState([]); // array of booking objects
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const queryClient = useQueryClient();

  // Drivers: leaders pick from all transport/chariot members; non-leaders are locked to themselves.
  const driverOptions = useMemo(() => {
    if (!isLeader && currentUserId) {
      const me = transportMembers.find(m => m.user_id === currentUserId);
      return me ? [{ id: currentUserId, name: `${me.first_name} ${me.last_name} (You)`, unit: me.unit_label }] : [];
    }
    const map = new Map();
    transportMembers.forEach(m => {
      if (m.user_id) map.set(m.user_id, { name: `${m.first_name} ${m.last_name}`, unit: m.unit_label });
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, name: v.name, unit: v.unit }));
  }, [transportMembers, isLeader, currentUserId]);

  // Auto-select self for non-leaders
  useEffect(() => {
    if (!isLeader && currentUserId && !driverId) setDriverId(currentUserId);
  }, [isLeader, currentUserId, driverId]);

  // Filter bookings for selected driver across the date range
  const candidates = useMemo(() => {
    if (!driverId || !dateFrom || !dateTo) return [];
    return bookings
      .filter(b => b.request_date >= dateFrom && b.request_date <= dateTo)
      .filter(b => b.driver_user_id === driverId || b.assigned_to === driverId)
      .filter(b => !["Cancelled", "No-Show", "Completed"].includes(b.status));
  }, [bookings, driverId, dateFrom, dateTo]);

  useEffect(() => {
    // Sort by date, then pickup_order (NULLS LAST), then pickup_time
    const sorted = [...candidates].sort((a, b) => {
      if (a.request_date !== b.request_date) return a.request_date.localeCompare(b.request_date);
      const ao = a.pickup_order ?? 9999;
      const bo = b.pickup_order ?? 9999;
      if (ao !== bo) return ao - bo;
      return (a.pickup_time || "").localeCompare(b.pickup_time || "");
    });
    setOrder(sorted);
  }, [candidates]);

  const move = (from, to) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  };

  const setTime = (idx, time) => {
    setOrder(prev => prev.map((b, i) => i === idx ? { ...b, pickup_time: time } : b));
  };

  const handleSave = async () => {
    if (!order.length) return;
    setSaving(true);
    try {
      await Promise.all(
        order.map((b, idx) =>
          supabase.from("transportation")
            .update({ pickup_order: idx + 1, pickup_time: b.pickup_time || null })
            .eq("id", b.id)
            .eq("tenant_id", tenantId)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      toast({ title: "Pickup order saved", description: `${order.length} stop(s) sequenced.` });
    } catch (err) {
      toast({ title: "Error saving order", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleNotify = async () => {
    const eligible = order.filter(b => b.pickup_time);
    if (!eligible.length) {
      toast({ title: "No pickup times set", description: "Set a pickup time on at least one stop first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    let sent = 0, failed = 0;
    try {
      const driverMember = transportMembers.find(m => m.user_id === driverId);
      const driverName = driverMember ? `${driverMember.first_name} ${driverMember.last_name}` : "";
      const driverPhone = driverMember?.phone || "";
      for (let i = 0; i < order.length; i++) {
        const b = order[i];
        if (!b.pickup_time) continue;
        const passengerName = b.members ? `${b.members.first_name} ${b.members.last_name}` : "Passenger";
        const { error } = await supabase.functions.invoke("notify-transport-booking", {
          body: {
            notification_type: "passenger_status",
            status: "Pickup Scheduled",
            booking_id: b.id,
            member_id: b.member_id,
            member_name: passengerName,
            pickup: b.pickup_address,
            pickup_location_description: b.pickup_location_description,
            destination: b.destination,
            request_date: b.request_date,
            pickup_time: b.pickup_time,
            journey_type: b.journey_type || "Single",
            return_date: b.return_date,
            return_time: b.return_time,
            driver_name: driverName,
            driver_phone: driverPhone,
            stop_number: i + 1,
            tenant_id: tenantId,
          },
        });
        if (error) failed++; else sent++;
      }
      toast({
        title: "Passengers notified",
        description: `${sent} sent${failed ? `, ${failed} failed` : ""}.`,
        variant: failed ? "destructive" : "default",
      });
    } finally {
      setSaving(false);
    }
  };
  const handleNotifyDriver = async () => {
    if (!driverId || !order.length) return;
    setSaving(true);
    try {
      const stops = order.map(b => ({
        passenger_name: b.members ? `${b.members.first_name} ${b.members.last_name}` : "Passenger",
        pickup_time: b.pickup_time || "",
        pickup_address: b.pickup_address || "",
        pickup_postcode: b.pickup_postcode || "",
        phone: b.members?.phone || "",
        passengers: b.passengers || 1,
      }));
      const { error } = await supabase.functions.invoke("notify-transport-booking", {
        body: {
          notification_type: "driver_route",
          driver_user_id: driverId,
          tenant_id: tenantId,
          date_from: dateFrom,
          date_to: dateTo,
          stops,
        },
      });
      if (error) throw error;
      toast({ title: "Driver notified", description: `Sent ${stops.length} stop(s) to driver.` });
    } catch (err) {
      toast({ title: "Error notifying driver", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const handlePrint = () => {
    if (!order.length) return;
    const driverMember = transportMembers.find(m => m.user_id === driverId);
    const driverName = driverMember ? `${driverMember.first_name} ${driverMember.last_name}` : "Driver";
    const dateLabel = dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`;
    const title = `${isLeader ? "Driver Route" : "My Route"} — ${driverName} — ${dateLabel}`;
    const totalPax = order.reduce((s, b) => s + (b.passengers || 1), 0);

    const headers = ["Stop #", ...(multiDay ? ["Date"] : []), "Pickup Time", "Passenger", "Phone", "Pax", "Pickup Address", "Postcode", "Pickup Notes", "Destination", "Status"];
    const rows = order.map((b, i) => {
      const passenger = b.members ? `${b.members.first_name} ${b.members.last_name}` : "Passenger";
      const cells = [
        i + 1,
        ...(multiDay ? [b.request_date || ""] : []),
        b.pickup_time || "TBC",
        passenger,
        b.members?.phone || "",
        b.passengers || 1,
        b.pickup_address || "",
        b.pickup_postcode || "",
        b.pickup_location_description || "",
        b.destination || "",
        b.status || "",
      ];
      return `<tr>${cells.map(c => `<td>${escHtml(c)}</td>`).join("")}</tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><title>${escHtml(title)}</title><style>
      body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}
      h1{font-size:18px;margin-bottom:4px;color:#1e3a5f}
      p.meta{font-size:11px;color:#666;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th{background:#1e3a5f;color:#fff;text-align:left;padding:8px 10px;font-size:11px}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
      tr:nth-child(even) td{background:#f8fafc}
      @media print{body{margin:0}}
    </style></head><body>
      <h1>${escHtml(title)}</h1>
      <p class="meta">Generated: ${escHtml(new Date().toLocaleString("en-GB"))} · ${order.length} stop(s) · ${totalPax} passenger(s)</p>
      <table><thead><tr>${headers.map(h => `<th>${escHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast({ title: "Pop-up blocked", description: "Please allow pop-ups to print your route.", variant: "destructive" });
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };



  const handleClear = async () => {
    if (!order.length) return;
    setSaving(true);
    try {
      await Promise.all(
        order.map(b =>
          supabase.from("transportation")
            .update({ pickup_order: null })
            .eq("id", b.id)
            .eq("tenant_id", tenantId)
        )
      );
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      toast({ title: "Order cleared" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoMatch = async () => {
    if (!dateFrom || !dateTo) return;
    const unassigned = bookings.filter(b =>
      b.request_date >= dateFrom && b.request_date <= dateTo &&
      !b.driver_user_id && !b.assigned_to &&
      !["Cancelled", "No-Show", "Completed"].includes(b.status)
    );
    if (!unassigned.length) {
      toast({ title: "Nothing to match", description: "No unassigned bookings in this date range." });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("match-driver-by-postcode", {
        body: { tenant_id: tenantId, booking_ids: unassigned.map(b => b.id) },
      });
      if (error) throw error;
      const matched = (data?.matches || []).filter(m => m.driver_user_id).length;
      queryClient.invalidateQueries({ queryKey: ["transportation"] });
      toast({
        title: "Auto-match complete",
        description: `Matched ${matched} of ${unassigned.length} passenger(s).`,
        variant: matched === 0 ? "destructive" : "default",
      });
    } catch (err) {
      toast({ title: "Auto-match failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const multiDay = dateFrom !== dateTo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" /> Plan Driver Route
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Driver</Label>
            <Select value={driverId} onValueChange={setDriverId} disabled={!isLeader && driverOptions.length <= 1}>
              <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
              <SelectContent>
                {["Kingdom Chariot", "Transportation"].map(group => {
                  const opts = driverOptions.filter(d => d.unit === group);
                  if (opts.length === 0) return null;
                  return (
                    <div key={group}>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{group}</div>
                      {opts.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </div>
                  );
                })}
                {driverOptions.filter(d => !["Kingdom Chariot", "Transportation"].includes(d.unit)).map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLeader && (
          <div className="mt-3">
            <Button onClick={handleAutoMatch} disabled={saving} variant="secondary" size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Auto-match Unassigned Passengers
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1">
              Matches unassigned bookings in the date range to drivers using their availability postcode.
            </p>
          </div>
        )}

        <div className="mt-4">
          {!driverId ? (
            <p className="text-sm text-muted-foreground text-center py-8">Select a driver and date range to plan their pickup route.</p>
          ) : order.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active bookings for this driver in the selected date range.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                {isLeader
                  ? "Drag stops to reorder, or use the arrows. Stop 1 is the first pickup."
                  : "Your route is set by your Transportation leader. Stops are shown in pickup order."}
              </p>
              <ol className="space-y-2">
                {order.map((b, idx) => {
                  const passenger = b.members ? `${b.members.first_name} ${b.members.last_name}` : "Passenger";
                  return (
                    <li
                      key={b.id}
                      draggable={isLeader}
                      onDragStart={() => isLeader && setDragIdx(idx)}
                      onDragOver={(e) => isLeader && e.preventDefault()}
                      onDrop={(e) => { if (!isLeader) return; e.preventDefault(); if (dragIdx !== null && dragIdx !== idx) move(dragIdx, idx); setDragIdx(null); }}
                      onDragEnd={() => setDragIdx(null)}
                      className={`flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors ${dragIdx === idx ? "opacity-50" : ""}`}
                    >
                      {isLeader && <GripVertical className="h-4 w-4 text-muted-foreground mt-1 shrink-0 cursor-grab" />}
                      <Badge className="bg-primary text-primary-foreground shrink-0">Stop {idx + 1}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground text-sm">{passenger}</p>
                          {multiDay && <Badge variant="outline" className="text-[10px]">{b.request_date}</Badge>}
                          {b.passenger_acknowledged_at ? (
                            <Badge variant="outline" className="text-[10px] text-chart-3 border-chart-3/40">
                              <CheckCircle className="h-3 w-3 mr-1" /> Acknowledged
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">Awaiting ack</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {b.pickup_address}</span>
                          {b.pickup_postcode && <span className="text-[11px]">[{b.pickup_postcode}]</span>}
                          {b.members?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {b.members.phone}</span>}
                          {b.passengers > 1 && <span>{b.passengers} pax</span>}
                        </div>
                        {b.pickup_location_description && (
                          <p className="text-[11px] text-foreground/80 italic mt-1 bg-primary/5 border-l-2 border-primary/40 pl-2 py-0.5 whitespace-pre-wrap">
                            “{b.pickup_location_description}”
                          </p>
                        )}
                        {b.passenger_acknowledged_at && (
                          <p className="text-[10px] text-chart-3 mt-1">
                            Acknowledged {new Date(b.passenger_acknowledged_at).toLocaleString()}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {isLeader ? (
                            <>
                              <Input
                                type="time"
                                value={b.pickup_time || ""}
                                onChange={(e) => setTime(idx, e.target.value)}
                                className="h-8 w-32 text-xs"
                              />
                              <span className="text-[11px] text-muted-foreground">Pickup time</span>
                            </>
                          ) : (
                            <span className="text-xs text-foreground font-medium">{b.pickup_time || "Time TBC"}</span>
                          )}
                        </div>
                      </div>
                      {isLeader && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(idx, idx - 1)} disabled={idx === 0}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(idx, idx + 1)} disabled={idx === order.length - 1}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              {isLeader ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Order & Times
                  </Button>
                  <Button onClick={handleNotifyDriver} disabled={saving} variant="secondary">
                    <Bell className="h-4 w-4 mr-2" />
                    Notify Driver
                  </Button>
                  <Button onClick={handleNotify} disabled={saving} variant="secondary">
                    <Bell className="h-4 w-4 mr-2" />
                    Notify Passengers
                  </Button>
                  <Button variant="outline" onClick={handlePrint} disabled={saving}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print Route
                  </Button>
                  <Button variant="outline" onClick={handleClear} disabled={saving}>
                    Clear Order
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button onClick={handlePrint} className="flex-1 bg-primary hover:bg-primary/90">
                    <Printer className="h-4 w-4 mr-2" />
                    Print My Route
                  </Button>
                </div>
              )}
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
