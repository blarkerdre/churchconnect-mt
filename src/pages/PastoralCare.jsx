import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Search, Lock, User, CalendarDays, Plus, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUnitMembership } from "@/hooks/useUnitMembership";

const statusColors = {
  "Open": "bg-accent/10 text-accent",
  "In Progress": "bg-primary/10 text-primary",
  "Resolved": "bg-chart-3/10 text-chart-3",
  "Closed": "bg-muted text-muted-foreground",
};

const CARE_TYPES = ["Counselling", "Visitation", "Prayer Request", "Hospital Visit", "Bereavement", "Marriage", "Financial Support", "Other"];

export default function PastoralCare() {
  const { user, isAdmin } = useAuth();
  const { isMemberOfUnit: isPastoralUnit } = useUnitMembership("Pastoral Care");
  const canManage = isAdmin || isPastoralUnit;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [form, setForm] = useState({ subject: "", care_type: "Prayer Request", description: "", confidential: false });
  const [statusUpdate, setStatusUpdate] = useState({ status: "", resolution_notes: "" });

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["pastoral-care"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pastoral_care")
        .select("*, members(first_name, last_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Non-pastoral unit members only see their own requests
  const visibleCases = canManage ? cases : cases.filter(c => c.created_by === user?.id);

  const requestMutation = useMutation({
    mutationFn: async (formData) => {
      const { data: member } = await supabase.from("members").select("id").eq("user_id", user.id).single();
      const { error } = await supabase.from("pastoral_care").insert({
        subject: formData.subject,
        care_type: formData.care_type,
        description: formData.description || null,
        confidential: formData.confidential,
        created_by: user.id,
        member_id: member?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastoral-care"] });
      toast({ title: "Request submitted" });
      setRequestDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { error } = await supabase.from("pastoral_care").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pastoral-care"] });
      toast({ title: "Case updated" });
      setManageDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = visibleCases.filter(r =>
    `${r.subject} ${r.members?.first_name || ""} ${r.members?.last_name || ""} ${r.care_type}`.toLowerCase().includes(search.toLowerCase())
  );

  const openManage = (c) => {
    setSelectedCase(c);
    setStatusUpdate({ status: c.status, resolution_notes: c.resolution_notes || "" });
    setManageDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-foreground">{visibleCases.length}</p><p className="text-xs text-muted-foreground">Total Cases</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-accent">{visibleCases.filter(r => r.status === "Open").length}</p><p className="text-xs text-muted-foreground">Open</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-primary">{visibleCases.filter(r => r.status === "In Progress").length}</p><p className="text-xs text-muted-foreground">In Progress</p></CardContent></Card>
        <Card className="border-0 shadow-sm"><CardContent className="p-4 text-center"><p className="text-2xl font-display font-bold text-chart-3">{visibleCases.filter(r => r.status === "Resolved").length}</p><p className="text-xs text-muted-foreground">Resolved</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cases..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={() => { setForm({ subject: "", care_type: "Prayer Request", description: "", confidential: false }); setRequestDialogOpen(true); }} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" /> New Request
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm p-12 text-center text-muted-foreground">
          <Heart className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No cases found</p>
        </Card>
      ) : (
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
                      <h3 className="font-display font-bold text-foreground">{r.subject}</h3>
                      {r.confidential && <Lock className="h-3.5 w-3.5 text-destructive" />}
                      <Badge className={`border-0 ${statusColors[r.status]}`}>{r.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {r.members && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {r.members.first_name} {r.members.last_name}</span>}
                      <span>{r.care_type}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {canManage && (r.status === "Open" || r.status === "In Progress") && (
                    <Button variant="outline" size="sm" onClick={() => openManage(r)}>Manage</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">New Pastoral Care Request</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief subject" /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.care_type} onValueChange={v => setForm(f => ({ ...f, care_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe your request..." /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="confidential" checked={form.confidential} onChange={e => setForm(f => ({ ...f, confidential: e.target.checked }))} className="rounded border-border" />
              <Label htmlFor="confidential" className="text-sm">Mark as confidential</Label>
            </div>
            <Button onClick={() => requestMutation.mutate(form)} disabled={requestMutation.isPending || !form.subject} className="w-full bg-primary">
              {requestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Submit Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Case Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Manage Case</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Status</Label>
              <Select value={statusUpdate.status} onValueChange={v => setStatusUpdate(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Open", "In Progress", "Resolved", "Closed"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Resolution Notes</Label><Textarea value={statusUpdate.resolution_notes} onChange={e => setStatusUpdate(f => ({ ...f, resolution_notes: e.target.value }))} rows={3} /></div>
            <Button onClick={() => updateMutation.mutate({ id: selectedCase.id, updates: statusUpdate })} disabled={updateMutation.isPending} className="w-full bg-primary">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Case
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
