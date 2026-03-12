import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Car, MapPin, Clock, User, Plus } from "lucide-react";

const BOOKINGS = [
  { id: 1, member: "Mary Williams", pickup: "Canton, Cardiff", destination: "Church", date: "2025-03-16", time: "9:15 AM", status: "Confirmed", driver: "David Obi" },
  { id: 2, member: "Ruth Bakare", pickup: "Splott, Cardiff", destination: "Church", date: "2025-03-16", time: "9:00 AM", status: "Pending", driver: null },
  { id: 3, member: "Peter Nnamdi", pickup: "Cathays, Cardiff", destination: "Church", date: "2025-03-16", time: "9:30 AM", status: "Confirmed", driver: "Emmanuel Okoro" },
  { id: 4, member: "Grace Eze", pickup: "Church", destination: "Grangetown, Cardiff", date: "2025-03-09", time: "1:00 PM", status: "Completed", driver: "David Obi" },
];

const statusColors = { "Confirmed": "bg-chart-3/10 text-chart-3", "Pending": "bg-accent/10 text-accent", "Completed": "bg-muted text-muted-foreground" };

export default function Transportation() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{BOOKINGS.length}</p><p className="text-xs text-muted-foreground">Total Bookings</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{BOOKINGS.filter(b => b.status === "Pending").length}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{BOOKINGS.filter(b => b.status === "Confirmed").length}</p><p className="text-xs text-muted-foreground">Confirmed</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-muted-foreground">{BOOKINGS.filter(b => b.status === "Completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
      </div>

      <div className="flex justify-end">
        <Button className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" /> Book Transport</Button>
      </div>

      <div className="space-y-3">
        {BOOKINGS.map(b => (
          <Card key={b.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-display font-bold text-foreground">{b.member}</h3>
                    <Badge className={`border-0 ${statusColors[b.status]}`}>{b.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {b.pickup} → {b.destination}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {b.date} · {b.time}</span>
                    {b.driver && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {b.driver}</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
