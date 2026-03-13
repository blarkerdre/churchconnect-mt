import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, MapPin, Clock, Users, Loader2, UserCog } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import WSFAttendanceTab from "@/components/wsf/WSFAttendanceTab";
import WSFCentreMembersDialog from "@/components/wsf/WSFCentreMembersDialog";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WSFManagement() {
  const { isAdmin, isWSFLeader, leaderUnits, user } = useAuth();
  const canManageWSF = isAdmin || isWSFLeader || leaderUnits.includes("WSF");

  // Find the current user's member record to determine their assigned centre
  const { data: myMember } = useQuery({
    queryKey: ["my-member-record", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("members").select("id").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user?.id && isWSFLeader && !isAdmin,
  });

  // For WSF leaders (non-admin), find which centres they lead
  const myCentreIds = !isAdmin && isWSFLeader && myMember
    ? centres.filter(c => c.leader_id === myMember.id).map(c => c.id)
    : [];

  const canEditCentre = (centre) => {
    if (isAdmin) return true;
    if (isWSFLeader && myMember && centre.leader_id === myMember.id) return true;
    return false;
  };

  const canCreateCentre = isAdmin;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [membersDialogCentre, setMembersDialogCentre] = useState(null);
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

  const { data: wsfLeaders = [] } = useQuery({
    queryKey: ["wsf-leader-users"],
    queryFn: async () => {
      // Get user_ids with wsf_leader role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles").select("user_id").eq("role", "wsf_leader");
      if (roleError) throw roleError;
      if (!roleData?.length) return [];
      const userIds = roleData.map(r => r.user_id);
      // Get members linked to those user_ids
      const { data, error } = await supabase
        .from("members").select("id, first_name, last_name, user_id")
        .in("user_id", userIds).order("first_name");
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
    setForm({ name: "", location: "", address: "", postcode: "", city: "Cardiff", coverage_postcodes: "", meeting_day: "", meeting_time: "", is_active: true, leader_id: "" });
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, location: c.location || "", address: c.address || "", postcode: c.postcode || "", city: c.city || "", coverage_postcodes: c.coverage_postcodes || "", meeting_day: c.meeting_day || "", meeting_time: c.meeting_time || "", is_active: c.is_active, leader_id: c.leader_id || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name) return toast({ title: "Centre name is required", variant: "destructive" });
    saveMutation.mutate({
      name: form.name,
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-bold text-foreground">WSF Management</h2>
        <p className="text-sm text-muted-foreground">Manage centres and track attendance</p>
      </div>

      <Tabs defaultValue="attendance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          {canManageWSF && <TabsTrigger value="centres">Centres</TabsTrigger>}
        </TabsList>

        <TabsContent value="attendance">
          <WSFAttendanceTab centres={!isAdmin && isWSFLeader && myCentreIds.length > 0 ? centres.filter(c => myCentreIds.includes(c.id)) : centres} />
        </TabsContent>

        {canManageWSF && (
          <TabsContent value="centres">
            <div className="space-y-4">
              <div className="flex justify-end">
                {canCreateCentre && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Centre</Button>}
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : centres.length === 0 ? (
                <Card className="border-0 shadow-sm"><CardContent className="p-8 text-center text-muted-foreground">No WSF centres yet.</CardContent></Card>
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
                            {canEditCentre(c) && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Edit className="h-3.5 w-3.5" /></Button>
                                {isAdmin && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm("Delete this centre?")) deleteMutation.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        {(c.address || c.location) && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{c.address || c.location}{c.postcode ? `, ${c.postcode}` : ""}</div>}
                        {c.coverage_postcodes && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 opacity-50" />Covers: {c.coverage_postcodes}</div>}
                        {c.meeting_day && <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{c.meeting_day}{c.meeting_time ? ` at ${c.meeting_time}` : ""}</div>}
                        {c.leader_id && <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5" />Leader: {getLeaderName(c.leader_id)}</div>}
                        <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-3.5 w-3.5" />{memberCounts[c.id] || 0} members</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Centre" : "New Centre"}</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5"><Label>Centre Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
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
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Centre Leader</Label>
                <Select value={form.leader_id} onValueChange={v => setForm(f => ({ ...f, leader_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select leader" /></SelectTrigger>
                  <SelectContent>{wsfLeaders.map(m => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {isAdmin && (
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              </div>
            )}
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
