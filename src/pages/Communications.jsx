import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Send, Pin, Search, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ANNOUNCEMENTS = [
  { id: 1, title: "Easter Conference Registration Now Open", body: "Register for our annual Easter Conference 2025. Guest ministers from Nigeria and Ghana. Limited seats available.", audience: "All Members", pinned: true, date: "2025-03-10" },
  { id: 2, title: "Midweek Service Time Change", body: "Please note that Wednesday Bible Study will now start at 7:00 PM instead of 6:30 PM effective immediately.", audience: "All Members", pinned: false, date: "2025-03-08" },
  { id: 3, title: "Youth Camp Applications", body: "Youth camp applications are now open for ages 13-25. Please see the youth pastor for forms.", audience: "Youth Ministry", pinned: false, date: "2025-03-05" },
  { id: 4, title: "Leaders Meeting – Saturday", body: "All unit leaders are to attend the quarterly leaders meeting this Saturday at 2:00 PM.", audience: "Leaders Only", pinned: true, date: "2025-03-07" },
];

export default function Communications() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "All Members" });

  const filtered = ANNOUNCEMENTS.filter(a =>
    `${a.title} ${a.body}`.toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter(a => a.pinned);
  const regular = filtered.filter(a => !a.pinned);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search announcements..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> New Announcement
        </Button>
      </div>

      {pinned.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" /> Pinned</h3>
          {pinned.map(a => (
            <Card key={a.id} className="border-0 shadow-sm border-l-4 border-l-accent">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-foreground">{a.title}</h3>
                      <Badge className="bg-accent/10 text-accent border-0">{a.audience}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.body}</p>
                    <p className="text-xs text-muted-foreground mt-2">{a.date}</p>
                  </div>
                  <Megaphone className="h-5 w-5 text-accent shrink-0" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {regular.map(a => (
          <Card key={a.id} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-display font-bold text-foreground">{a.title}</h3>
                  <Badge variant="secondary">{a.audience}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                <p className="text-xs text-muted-foreground mt-2">{a.date}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="border-0 shadow-sm p-16 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">No announcements found</p>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">New Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Message</Label><Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} /></div>
            <div>
              <Label>Audience</Label>
              <Select value={form.audience} onValueChange={v => setForm(f => ({ ...f, audience: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["All Members", "Leaders Only", "Youth Ministry", "Women's Ministry", "Men's Ministry"].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full bg-primary"><Send className="h-4 w-4 mr-2" /> Publish</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
