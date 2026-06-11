import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, Download, Printer } from "lucide-react";
import PrintReportButton from "@/components/PrintReportButton";

function pct(n, d) { return d > 0 ? Math.round((n / d) * 1000) / 10 : 0; }

function groupCount(items, keyFn) {
  const map = new Map();
  items.forEach(i => {
    const k = keyFn(i) || "—";
    map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function minutesBetween(a, b) {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return diff >= 0 ? diff : null;
}

function avg(arr) {
  const v = arr.filter(n => typeof n === "number");
  if (!v.length) return null;
  return v.reduce((s, n) => s + n, 0) / v.length;
}

export default function TransportReportDialog({ open, onOpenChange, bookings, assigneeMap, dateFrom, dateTo }) {
  const stats = useMemo(() => {
    const total = bookings.length;
    const byStatus = groupCount(bookings, b => b.status);
    const byJourney = groupCount(bookings, b => b.journey_type || "Single");
    const byDestination = groupCount(bookings, b => b.destination || "Church");
    const byPickup = groupCount(bookings, b => b.pickup_address);
    const byAssignee = groupCount(bookings, b => b.assigned_to ? (assigneeMap[b.assigned_to] || "Assigned") : "Unassigned");
    const byDriver = groupCount(bookings.filter(b => b.assigned_driver), b => b.assigned_driver);
    const byDate = groupCount(bookings, b => b.request_date);

    const completed = bookings.filter(b => b.status === "Completed").length;
    const cancelled = bookings.filter(b => b.status === "Cancelled").length;
    const noShow = bookings.filter(b => b.status === "No-Show").length;
    const pending = bookings.filter(b => b.status === "Pending").length;
    const assigned = bookings.filter(b => b.assigned_to).length;
    const acknowledged = bookings.filter(b => b.passenger_acknowledged_at).length;
    const totalPassengers = bookings.reduce((s, b) => s + (Number(b.passengers) || 1), 0);
    const roundTrips = bookings.filter(b => b.journey_type === "Round Trip").length;

    const responseTimes = bookings
      .map(b => minutesBetween(b.created_at, b.notified_at))
      .filter(n => n !== null);
    const pickupDurations = bookings
      .map(b => minutesBetween(b.checked_in_at, b.picked_up_at))
      .filter(n => n !== null);
    const ackDelays = bookings
      .map(b => minutesBetween(b.notified_at, b.passenger_acknowledged_at))
      .filter(n => n !== null);

    return {
      total, byStatus, byJourney, byDestination, byPickup, byAssignee, byDriver, byDate,
      completed, cancelled, noShow, pending, assigned, acknowledged,
      totalPassengers, roundTrips,
      avgResponseMin: avg(responseTimes),
      avgPickupMin: avg(pickupDurations),
      avgAckMin: avg(ackDelays),
    };
  }, [bookings, assigneeMap]);

  const fmtMin = (n) => n == null ? "—" : (n < 60 ? `${Math.round(n)} min` : `${(n / 60).toFixed(1)} h`);

  const rangeLabel = (dateFrom || dateTo) ? `${dateFrom || "…"} → ${dateTo || "…"}` : "All time";

  const downloadCSV = () => {
    const sections = [];
    sections.push(`Transportation Report,,Range:,${rangeLabel}`);
    sections.push("");
    sections.push("Summary");
    sections.push(`Total bookings,${stats.total}`);
    sections.push(`Total passengers,${stats.totalPassengers}`);
    sections.push(`Round trips,${stats.roundTrips}`);
    sections.push(`Completed,${stats.completed} (${pct(stats.completed, stats.total)}%)`);
    sections.push(`Pending,${stats.pending}`);
    sections.push(`Cancelled,${stats.cancelled}`);
    sections.push(`No-Show,${stats.noShow}`);
    sections.push(`Assigned,${stats.assigned} (${pct(stats.assigned, stats.total)}%)`);
    sections.push(`Passenger acknowledged,${stats.acknowledged}`);
    sections.push(`Avg response time,${fmtMin(stats.avgResponseMin)}`);
    sections.push(`Avg pickup duration,${fmtMin(stats.avgPickupMin)}`);
    sections.push(`Avg acknowledgement delay,${fmtMin(stats.avgAckMin)}`);
    const addGroup = (title, group) => {
      sections.push("");
      sections.push(title);
      sections.push("Label,Count,%");
      group.forEach(([k, v]) => sections.push(`"${k}",${v},${pct(v, stats.total)}%`));
    };
    addGroup("By status", stats.byStatus);
    addGroup("By journey type", stats.byJourney);
    addGroup("By destination", stats.byDestination);
    addGroup("By pickup location", stats.byPickup);
    addGroup("By assignee", stats.byAssignee);
    addGroup("By driver", stats.byDriver);
    addGroup("By date", stats.byDate);
    const blob = new Blob([sections.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transportation-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printRows = () => {
    const rows = [];
    rows.push(["Total bookings", String(stats.total)]);
    rows.push(["Total passengers", String(stats.totalPassengers)]);
    rows.push(["Round trips", String(stats.roundTrips)]);
    rows.push(["Completed", `${stats.completed} (${pct(stats.completed, stats.total)}%)`]);
    rows.push(["Pending", String(stats.pending)]);
    rows.push(["Cancelled", String(stats.cancelled)]);
    rows.push(["No-Show", String(stats.noShow)]);
    rows.push(["Assigned", `${stats.assigned} (${pct(stats.assigned, stats.total)}%)`]);
    rows.push(["Passenger acknowledged", String(stats.acknowledged)]);
    rows.push(["Avg response time", fmtMin(stats.avgResponseMin)]);
    rows.push(["Avg pickup duration", fmtMin(stats.avgPickupMin)]);
    rows.push(["Avg acknowledgement delay", fmtMin(stats.avgAckMin)]);
    const push = (label, group) => group.forEach(([k, v]) => rows.push([`${label}: ${k}`, `${v} (${pct(v, stats.total)}%)`]));
    push("Status", stats.byStatus);
    push("Journey", stats.byJourney);
    push("Destination", stats.byDestination);
    push("Pickup", stats.byPickup);
    push("Assignee", stats.byAssignee);
    push("Driver", stats.byDriver);
    return {
      title: `Transportation Report — ${rangeLabel}`,
      headers: ["Metric", "Value"],
      rows,
    };
  };

  const Section = ({ title, group }) => (
    <div>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      {group.length === 0 ? (
        <p className="text-xs text-muted-foreground">No data</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8">Label</TableHead>
              <TableHead className="h-8 w-20 text-right">Count</TableHead>
              <TableHead className="h-8 w-16 text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell className="py-1.5">{k}</TableCell>
                <TableCell className="py-1.5 text-right font-medium">{v}</TableCell>
                <TableCell className="py-1.5 text-right text-muted-foreground">{pct(v, stats.total)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Transportation Report
          </DialogTitle>
          <DialogDescription>
            Comprehensive breakdown of bookings — {rangeLabel}. Reflects current filters.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={downloadCSV} disabled={stats.total === 0}>
            <Download className="h-4 w-4 mr-1.5" /> CSV
          </Button>
          <PrintReportButton label="Print" buildRows={printRows} />
        </div>

        {stats.total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No bookings in the current filter.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
                <p className="text-2xl font-display font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bookings</p>
              </CardContent></Card>
              <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
                <p className="text-2xl font-display font-bold">{stats.totalPassengers}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Passengers</p>
              </CardContent></Card>
              <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
                <p className="text-2xl font-display font-bold text-chart-3">{pct(stats.completed, stats.total)}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Completion</p>
              </CardContent></Card>
              <Card className="border-0 shadow-sm"><CardContent className="p-3 text-center">
                <p className="text-2xl font-display font-bold text-primary">{pct(stats.assigned, stats.total)}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Assigned</p>
              </CardContent></Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Card className="border-0 shadow-sm"><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Avg response time</p>
                <p className="text-lg font-semibold">{fmtMin(stats.avgResponseMin)}</p>
                <p className="text-[10px] text-muted-foreground">Created → Notified</p>
              </CardContent></Card>
              <Card className="border-0 shadow-sm"><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Avg pickup duration</p>
                <p className="text-lg font-semibold">{fmtMin(stats.avgPickupMin)}</p>
                <p className="text-[10px] text-muted-foreground">Checked In → Picked Up</p>
              </CardContent></Card>
              <Card className="border-0 shadow-sm"><CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Avg acknowledgement</p>
                <p className="text-lg font-semibold">{fmtMin(stats.avgAckMin)}</p>
                <p className="text-[10px] text-muted-foreground">Notified → Acknowledged</p>
              </CardContent></Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Round Trips: {stats.roundTrips}</Badge>
              <Badge variant="outline">Pending: {stats.pending}</Badge>
              <Badge variant="outline">Cancelled: {stats.cancelled}</Badge>
              <Badge variant="outline">No-Show: {stats.noShow}</Badge>
              <Badge variant="outline">Acknowledged: {stats.acknowledged}</Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <Section title="By status" group={stats.byStatus} />
              <Section title="By journey type" group={stats.byJourney} />
              <Section title="By destination" group={stats.byDestination} />
              <Section title="By pickup location" group={stats.byPickup} />
              <Section title="By assignee" group={stats.byAssignee} />
              <Section title="By driver" group={stats.byDriver} />
            </div>

            <Section title="By date" group={stats.byDate} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
