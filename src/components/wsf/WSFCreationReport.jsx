import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PrintReportButton from "@/components/PrintReportButton";

function startOfYear() {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}
function toInputDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function WSFCreationReport({ centres = [], zones = [], members = [] }) {
  const [from, setFrom] = useState(toInputDate(startOfYear()));
  const [to, setTo] = useState(toInputDate(new Date()));

  const zoneMap = useMemo(() => {
    const m = {};
    zones.forEach(z => { m[z.id] = z; });
    return m;
  }, [zones]);

  const memberMap = useMemo(() => {
    const m = {};
    members.forEach(x => { m[x.id] = `${x.first_name} ${x.last_name}`; });
    return m;
  }, [members]);

  const applyPreset = (preset) => {
    const today = new Date();
    if (preset === "month") {
      setFrom(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
      setTo(toInputDate(today));
    } else if (preset === "30d") {
      const d = new Date(); d.setDate(d.getDate() - 30);
      setFrom(toInputDate(d));
      setTo(toInputDate(today));
    } else if (preset === "year") {
      setFrom(toInputDate(startOfYear()));
      setTo(toInputDate(today));
    } else if (preset === "all") {
      setFrom("");
      setTo("");
    }
  };

  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
    const toMs = to ? new Date(to + "T23:59:59.999").getTime() : Infinity;
    return centres
      .filter(c => {
        if (!c.created_at) return false;
        const t = new Date(c.created_at).getTime();
        return t >= fromMs && t <= toMs;
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [centres, from, to]);

  const buildRows = () => ({
    title: `Home Cells Created${from ? ` from ${from}` : ""}${to ? ` to ${to}` : ""}`,
    headers: ["Name", "Zone", "City", "Postcode", "Leader", "Host", "Meeting Day", "Status", "Created"],
    rows: filtered.map(c => [
      c.name || "",
      zoneMap[c.zone_id]?.name || "",
      c.city || "",
      c.postcode || "",
      memberMap[c.leader_id] || "",
      c.host_name || "",
      c.meeting_day || "",
      c.is_active === false ? "Hidden" : "Active",
      formatDate(c.created_at),
    ]),
  });

  const rangeLabel = from || to ? `between ${from || "the beginning"} and ${to || "today"}` : "(all time)";

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Home Cells Created</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => applyPreset("month")}>This month</Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset("30d")}>Last 30 days</Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset("year")}>This year</Button>
          <Button size="sm" variant="outline" onClick={() => applyPreset("all")}>All time</Button>
          <div className="ml-auto">
            <PrintReportButton buildRows={buildRows} label="Print Report" />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          <strong>{filtered.length}</strong> Home Cell{filtered.length === 1 ? "" : "s"} created {rangeLabel}.
        </p>

        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center border rounded-lg">
            No Home Cells were created in this range.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Name</th>
                  <th className="text-left p-2 font-medium">Zone</th>
                  <th className="text-left p-2 font-medium">City</th>
                  <th className="text-left p-2 font-medium">Postcode</th>
                  <th className="text-left p-2 font-medium">Leader</th>
                  <th className="text-left p-2 font-medium">Host</th>
                  <th className="text-left p-2 font-medium">Meeting Day</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium whitespace-nowrap">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.name}</td>
                    <td className="p-2">{zoneMap[c.zone_id]?.name || "—"}</td>
                    <td className="p-2">{c.city || "—"}</td>
                    <td className="p-2">{c.postcode || "—"}</td>
                    <td className="p-2">{memberMap[c.leader_id] || "—"}</td>
                    <td className="p-2">{c.host_name || "—"}</td>
                    <td className="p-2">{c.meeting_day || "—"}</td>
                    <td className="p-2">
                      {c.is_active === false
                        ? <Badge variant="secondary">Hidden</Badge>
                        : <Badge>Active</Badge>}
                    </td>
                    <td className="p-2 whitespace-nowrap">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
