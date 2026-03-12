import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Heart, Search, Lock, User, CalendarDays, Plus } from "lucide-react";

const RECORDS = [
  { id: 1, title: "Marriage Counselling", member: "James & Ruth Adeyemi", category: "Counselling", status: "In Progress", date: "2025-03-10", assigned_leader: "Pastor Williams", confidential: true },
  { id: 2, title: "Bereavement Support", member: "Grace Eze", category: "Bereavement", status: "Open", date: "2025-03-08", assigned_leader: "Deacon Olu", confidential: false },
  { id: 3, title: "Prayer Request – Healing", member: "Rebecca Osei", category: "Prayer", status: "Open", date: "2025-03-12", assigned_leader: "Pastor Williams", confidential: false },
  { id: 4, title: "Financial Guidance", member: "Emmanuel Okoro", category: "Counselling", status: "Resolved", date: "2025-02-28", assigned_leader: "Deacon Sarah", confidential: true },
  { id: 5, title: "Hospital Visitation", member: "Mary Williams", category: "Visitation", status: "Closed", date: "2025-02-20", assigned_leader: "Deacon Olu", confidential: false },
];

const statusColors = { "Open": "bg-accent/10 text-accent", "In Progress": "bg-primary/10 text-primary", "Resolved": "bg-chart-3/10 text-chart-3", "Closed": "bg-muted text-muted-foreground" };

export default function PastoralCare() {
  const [search, setSearch] = useState("");

  const filtered = RECORDS.filter(r =>
    `${r.title} ${r.member} ${r.category} ${r.assigned_leader}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{RECORDS.length}</p><p className="text-xs text-muted-foreground">Total Cases</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{RECORDS.filter(r => r.status === "Open").length}</p><p className="text-xs text-muted-foreground">Open</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{RECORDS.filter(r => r.status === "In Progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{RECORDS.filter(r => r.status === "Resolved").length}</p><p className="text-xs text-muted-foreground">Resolved</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cases..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" /> New Case</Button>
      </div>

      <div className="space-y-3">
        {filtered.map(r => (
          <Card key={r.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-chart-5/10 flex items-center justify-center shrink-0">
                  <Heart className="h-5 w-5 text-chart-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-display font-bold text-foreground">{r.title}</h3>
                    {r.confidential && <Lock className="h-3.5 w-3.5 text-destructive" />}
                    <Badge className={`border-0 ${statusColors[r.status]}`}>{r.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {r.member}</span>
                    <span>{r.category}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {r.date}</span>
                    <span>Leader: {r.assigned_leader}</span>
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
