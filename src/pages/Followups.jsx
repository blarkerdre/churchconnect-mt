import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeartHandshake, Search, Phone, MessageSquare, CalendarCheck, Plus, AlertCircle } from "lucide-react";

const FOLLOWUPS = [
  { id: 1, person_name: "Peter Nnamdi", type: "First Timer", priority: "High", status: "Pending", assigned_to: "Grace Eze", scheduled_date: "2025-03-14", notes: "Visited on Sunday, expressed interest in youth group" },
  { id: 2, person_name: "Amaka Ude", type: "Absentee", priority: "Medium", status: "In Progress", assigned_to: "Emmanuel Okoro", scheduled_date: "2025-03-12", notes: "Missed 3 consecutive Sundays" },
  { id: 3, person_name: "John Mensah", type: "New Convert", priority: "High", status: "Pending", assigned_to: "David Obi", scheduled_date: "2025-03-15", notes: "Gave life to Christ last Sunday, needs BFC enrollment" },
  { id: 4, person_name: "Rebecca Osei", type: "Pastoral", priority: "Urgent", status: "Pending", assigned_to: "Grace Eze", scheduled_date: "2025-03-13", notes: "Requested prayer for healing" },
  { id: 5, person_name: "Samuel Ike", type: "First Timer", priority: "Low", status: "Completed", assigned_to: "James Adeyemi", scheduled_date: "2025-03-08", notes: "Called and welcomed, invited to midweek service" },
];

const priorityColors = { "Urgent": "bg-destructive/10 text-destructive", "High": "bg-chart-5/10 text-chart-5", "Medium": "bg-accent/10 text-accent", "Low": "bg-muted text-muted-foreground" };
const statusColors = { "Pending": "bg-accent/10 text-accent", "In Progress": "bg-primary/10 text-primary", "Completed": "bg-chart-3/10 text-chart-3" };
const typeIcons = { "First Timer": MessageSquare, "Absentee": AlertCircle, "New Convert": HeartHandshake, "Pastoral": Phone };

export default function Followups() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = FOLLOWUPS.filter(f => {
    const matchSearch = `${f.person_name} ${f.assigned_to} ${f.type}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{FOLLOWUPS.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{FOLLOWUPS.filter(f => f.status === "Pending").length}</p><p className="text-xs text-muted-foreground">Pending</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{FOLLOWUPS.filter(f => f.status === "In Progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{FOLLOWUPS.filter(f => f.status === "Completed").length}</p><p className="text-xs text-muted-foreground">Completed</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search follow-ups..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All", "Pending", "In Progress", "Completed"].map(s => <SelectItem key={s} value={s}>{s === "All" ? "All Status" : s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" /> New Follow-up</Button>
      </div>

      <div className="space-y-3">
        {filtered.map(f => {
          const Icon = typeIcons[f.type] || HeartHandshake;
          return (
            <Card key={f.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-foreground">{f.person_name}</h3>
                      <Badge className={`border-0 ${priorityColors[f.priority]}`}>{f.priority}</Badge>
                      <Badge className={`border-0 ${statusColors[f.status]}`}>{f.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{f.notes}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{f.type}</span>
                      <span>Assigned: {f.assigned_to}</span>
                      <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" /> {f.scheduled_date}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="border-0 shadow-sm p-16 text-center text-muted-foreground">
            <HeartHandshake className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">No follow-ups found</p>
          </Card>
        )}
      </div>
    </div>
  );
}
