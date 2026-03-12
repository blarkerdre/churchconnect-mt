import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Clock, Users, CalendarCheck } from "lucide-react";

const SESSIONS = [
  { id: 1, title: "Sunday Worship – 10 Mar", date: "2025-03-10", type: "Sunday Service", total: 185, present: 162, late: 8, absent: 15 },
  { id: 2, title: "Midweek Bible Study – 12 Mar", date: "2025-03-12", type: "Bible Study", total: 90, present: 72, late: 5, absent: 13 },
  { id: 3, title: "Sunday Worship – 3 Mar", date: "2025-03-03", type: "Sunday Service", total: 185, present: 170, late: 6, absent: 9 },
  { id: 4, title: "Youth Fellowship – 7 Mar", date: "2025-03-07", type: "Youth Event", total: 45, present: 38, late: 3, absent: 4 },
];

const RECENT_CHECKINS = [
  { name: "Sarah Johnson", time: "10:02 AM", status: "Present" },
  { name: "David Obi", time: "10:15 AM", status: "Late" },
  { name: "Grace Eze", time: "9:58 AM", status: "Present" },
  { name: "James Adeyemi", time: "10:05 AM", status: "Present" },
  { name: "Emmanuel Okoro", time: "10:22 AM", status: "Late" },
];

export default function Attendance() {
  const [selectedSession, setSelectedSession] = useState(SESSIONS[0]);

  const attendanceRate = Math.round(((selectedSession.present + selectedSession.late) / selectedSession.total) * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{selectedSession.present}</p><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{selectedSession.late}</p><p className="text-xs text-muted-foreground">Late</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-destructive">{selectedSession.absent}</p><p className="text-xs text-muted-foreground">Absent</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{attendanceRate}%</p><p className="text-xs text-muted-foreground">Rate</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={String(selectedSession.id)} onValueChange={v => setSelectedSession(SESSIONS.find(s => s.id === parseInt(v)))}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SESSIONS.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge className="bg-primary/10 text-primary border-0">{selectedSession.type}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-accent" /> All Sessions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {SESSIONS.map(s => {
              const rate = Math.round(((s.present + s.late) / s.total) * 100);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedSession.id === s.id ? "bg-primary/10 border border-primary/20" : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.type} · {s.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{rate}%</p>
                    <p className="text-xs text-muted-foreground">{s.present + s.late}/{s.total}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Recent Check-ins</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {RECENT_CHECKINS.map((c, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {c.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {c.time}</p>
                  </div>
                </div>
                <Badge className={`border-0 ${c.status === "Present" ? "bg-chart-3/10 text-chart-3" : "bg-accent/10 text-accent"}`}>
                  {c.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
