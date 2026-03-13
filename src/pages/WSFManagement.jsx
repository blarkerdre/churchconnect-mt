import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, MapPin, Clock, Users, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WSFManagement() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", location: "", meeting_day: "", meeting_time: "", is_active: true, leader_id: "" });
  const queryClient = useQueryClient();

  const { data: centres = [], isLoading } = useQuery({
    queryKey: ["wsf-centres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wsf_centres").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-for-leaders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, first_name, last_name").eq("membership_status", "Active").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Count members per centre
  const { data: memberCounts = {} } = useQuery({
    queryKey: ["wsf-member-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("wsf_centre_id").not("wsf_centre_id", "is", null);
      if (error) throw error;
      const counts = {};
      data.forEach(m => { counts[m.wsf_centre_id] = (counts[m.wsf_centre_id] || 0) + 1; });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        const { error } = await supabase.from("wsf_centres").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wsf_centres").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-centres"] });
      queryClient.invalidateQueries({ queryKey: ["wsf-member-counts"] });
      toast({ title: editing ? "Centre updated" : "Centre created" });
      setDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("wsf_centres").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-centres"] });
      toast({ title: "Centre deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", location: "", meeting_day: "", meeting_time: "", is_active: true, leader_id: "" });
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, location: c.location || "", meeting_day: c.meeting_day || "", meeting_time: c.meeting_time || "", is_active: c.is_active, leader_id: c.leader_id || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name) return toast({ title: "Centre name is required", variant: "destructive" });
    saveMutation.mutate({
      name: form.name,
      location: form.location || null,
      meeting_day: form.meeting_day || null,
      meeting_time: form.meeting_time || null,
      is_active: form.is_active,
      leader_id: form.leader_id || null,
    });
  };

  const getLeaderName = (leaderId) => {
    const m = members.find(m => m.id === leaderId);
    return m ? `${m.first_name} ${m.last_name}` : "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">WSF Centres</h2>
          <p className="text-sm text-muted-foreground">Manage Winners Satellite Fellowship centres</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Centre</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : centres.length === 0 ? (
        <Card className="border-0 shadow-sm"><CardContent className="p-8 text-center text-muted-foreground">No WSF centres yet. Create your first centre.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {centres.map(c => (
            <Card key={c.id} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-display">{c.name}</CardTitle>
                    <Badge className={c.is_active ? "bg-chart-3/10 text-chart-3 border-0 mt-1" : "bg-muted text-muted-foreground border-0 mt-1"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm("Delete this centre?")) deleteMutation.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {c.location && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{c.location}</div>}
                {c.meeting_day && <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{c.meeting_day}{c.meeting_time ? ` at ${c.meeting_time}` : ""}</div>}
                {c.leader_id && <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5" />Leader: {getLeaderName(c.leader_id)}</div>}
                <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5" />{memberCounts[c.id] || 0} members</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Centre" : "New Centre"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Centre Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Location</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. CF10 area" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Meeting Day</Label>
                <Select value={form.meeting_day} onValueChange={v => setForm(f => ({ ...f, meeting_day: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Meeting Time</Label><Input type="time" value={form.meeting_time} onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Centre Leader</Label>
              <Select value={form.leader_id} onValueChange={v => setForm(f => ({ ...f, leader_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select leader" /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
