import { CalendarDays, Clock, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const events = [
  { id: 1, name: "Sunday Worship Service", date: "Mar 10, 2026", time: "10:00 AM", location: "Main Sanctuary", type: "Worship", recurring: true },
  { id: 2, name: "Youth Group Meeting", date: "Mar 11, 2026", time: "6:30 PM", location: "Youth Hall", type: "Youth", recurring: true },
  { id: 3, name: "Midweek Bible Study", date: "Mar 12, 2026", time: "7:00 PM", location: "Fellowship Hall", type: "Study", recurring: true },
  { id: 4, name: "Community Outreach Day", date: "Mar 15, 2026", time: "9:00 AM", location: "Community Center", type: "Outreach", recurring: false },
  { id: 5, name: "Choir Rehearsal", date: "Mar 13, 2026", time: "7:00 PM", location: "Choir Room", type: "Music", recurring: true },
  { id: 6, name: "Women's Fellowship Brunch", date: "Mar 16, 2026", time: "10:30 AM", location: "Fellowship Hall", type: "Fellowship", recurring: false },
  { id: 7, name: "Easter Planning Meeting", date: "Mar 18, 2026", time: "6:00 PM", location: "Conference Room", type: "Admin", recurring: false },
  { id: 8, name: "Prayer Night", date: "Mar 20, 2026", time: "7:00 PM", location: "Chapel", type: "Prayer", recurring: true },
];

const typeColors: Record<string, string> = {
  Worship: "default",
  Youth: "secondary",
  Study: "outline",
  Outreach: "default",
  Music: "secondary",
  Fellowship: "secondary",
  Admin: "outline",
  Prayer: "default",
};

export default function Events() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1">Manage your church events and schedule</p>
        </div>
        <Button className="gap-2 self-start">
          <Plus className="h-4 w-4" />
          New Event
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((event) => (
          <div key={event.id} className="stat-card flex flex-col gap-3 cursor-pointer">
            <div className="flex items-start justify-between">
              <h3 className="font-display font-semibold text-base">{event.name}</h3>
              <Badge variant={typeColors[event.type] as any} className="font-normal shrink-0 ml-2">
                {event.type}
              </Badge>
            </div>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-3.5 w-3.5" />
                <span>{event.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                <span>{event.time}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                <span>{event.location}</span>
              </div>
            </div>
            {event.recurring && (
              <span className="text-xs text-primary font-medium">↻ Recurring</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
