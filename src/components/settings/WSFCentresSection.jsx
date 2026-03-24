import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, MapPin, Clock, Users, Loader2, Globe, UserCog } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import WSFCentreMembersDialog from "@/components/wsf/WSFCentreMembersDialog";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WSFCentresSection() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [membersDialogCentre, setMembersDialogCentre] = useState(null);
  const [form, setForm] = useState({ name: "", host_name: "", host_member_id: "", location: "", address: "", postcode: "", city: "Cardiff", coverage_postcodes: "", meeting_day: "", meeting_time: "", is_active: true, leader_id: "", zone_id: "" });

  const { data: centres = [], isLoading } = useQuery({
    queryKey: ["wsf-centres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wsf_centres").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: wsfLeaders = [] } = useQuery({
    queryKey: ["wsf-leader-users"],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles").select("user_id").eq("role", "wsf_leader");
      if (roleError) throw roleError;
      if (!roleData?.length) return [];
      const userIds = roleData.map(r => r.user_id);
      const { data, error } = await supabase
        .from("members").select("id, first_name, last_name, user_id")
        .in("user_id", userIds).order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["all-members-for-host"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members").select("id, first_name, last_name, address, postcode, city")
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["wsf-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wsf_zones").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

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
    setForm({ name: "", host_name: "", host_member_id: "", location: "", address: "", postcode: "", city: "Cardiff", coverage_postcodes: "", meeting_day: "", meeting_time: "", is_active: true, leader_id: "", zone_id: "" });
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, host_name: c.host_name || "", host_member_id: c.host_member_id || "", location: c.location || "", address: c.address || "", postcode: c.postcode || "", city: c.city || "", coverage_postcodes: c.coverage_postcodes || "", meeting_day: c.meeting_day || "", meeting_time: c.meeting_time || "", is_active: c.is_active, leader_id: c.leader_id || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name) return toast({ title: "Centre name is required", variant: "destructive" });
    const selectedHost = allMembers.find(m => m.id === form.host_member_id);
    const derivedHostName = selectedHost ? `${selectedHost.first_name} ${selectedHost.last_name}` : (form.host_name || null);
    saveMutation.mutate({
      name: form.name,
      host_name: derivedHostName,
      host_member_id: form.host_member_id || null,
      location: form.location || null,
      address: form.address || null,
      postcode: form.postcode || null,
      city: form.city || null,
      coverage_postcodes: form.coverage_postcodes || null,
      meeting_day: form.meeting_day || null,
      meeting_time: form.meeting_time || null,
      is_active: form.is_active,
      leader_id: form.leader_id || null,
    });
  };

  const getLeaderName = (leaderId) => {
    const m = wsfLeaders.find(m => m.id === leaderId);
    return m ? `${m.first_name} ${m.last_name}` : "—";
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Globe className="h-4 w-4 text-accent" /> WSF Centres
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Manage Winners Satellite Fellowship centres</p>
            </div>
            <Button size="sm" onClick={openNew} className="gap-1.5 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Add Centre
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : centres.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No WSF centres configured</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {centres.map(c => (
                <div key={c.id} className="p-3 sm:p-4 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.name}</p>
                      <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs mt-1">
                        {c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm("Delete this centre?")) deleteMutation.mutate(c.id); }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {(c.host_member_id || c.host_name) && <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />House Provider: {c.host_member_id ? (() => { const m = allMembers.find(m => m.id === c.host_member_id); return m ? `${m.first_name} ${m.last_name}` : c.host_name; })() : c.host_name}</div>}
                    {(c.address || c.location) && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" />{c.address || c.location}{c.postcode ? `, ${c.postcode}` : ""}</div>}
                    {c.meeting_day && <div className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{c.meeting_day}{c.meeting_time ? ` at ${c.meeting_time}` : ""}</div>}
                    {c.leader_id && <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />Leader: {getLeaderName(c.leader_id)}</div>}
                    <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{memberCounts[c.id] || 0} members</div>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMembersDialogCentre(c)}>
                    <UserCog className="h-3 w-3 mr-1" /> Manage Members
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Centre" : "New Centre"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5"><Label>Centre Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>House Provider</Label>
              <Select value={form.host_member_id} onValueChange={v => { const m = allMembers.find(x => x.id === v); setForm(f => ({ ...f, host_member_id: v, address: m?.address || f.address, postcode: m?.postcode || f.postcode, city: m?.city || f.city })); }}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>{allMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street address" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>City</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Cardiff" /></div>
              <div className="space-y-1.5"><Label>Postcode</Label><Input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} placeholder="CF10 1AB" /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Coverage Postcodes</Label>
              <Input value={form.coverage_postcodes} onChange={e => setForm(f => ({ ...f, coverage_postcodes: e.target.value }))} placeholder="CF10, CF11, CF14" />
              <p className="text-xs text-muted-foreground">Comma-separated postcode prefixes this centre serves</p>
            </div>
            <div className="space-y-1.5"><Label>Location Description</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Near Cardiff Bay" /></div>
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
                <SelectContent>{wsfLeaders.map(m => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
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

      <WSFCentreMembersDialog
        open={!!membersDialogCentre}
        onOpenChange={(open) => { if (!open) setMembersDialogCentre(null); }}
        centre={membersDialogCentre}
      />
    </>
  );
}
