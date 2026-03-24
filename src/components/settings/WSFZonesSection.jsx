import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Loader2, MapPin } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";

export default function WSFZonesSection() {
  const queryClient = useQueryClient();
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", is_active: true });

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["wsf-zones", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("wsf_zones").select("*").order("name"));
      if (error) throw error;
      return data;
    },
  });

  const { data: centreCounts = {} } = useQuery({
    queryKey: ["wsf-zone-centre-counts", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("wsf_centres").select("zone_id").not("zone_id", "is", null));
      if (error) throw error;
      const counts = {};
      data.forEach(c => { counts[c.zone_id] = (counts[c.zone_id] || 0) + 1; });
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (editing) {
        const { error } = await supabase.from("wsf_zones").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wsf_zones").insert(withTenant(payload));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-zones"] });
      queryClient.invalidateQueries({ queryKey: ["wsf-zone-centre-counts"] });
      toast({ title: editing ? "Zone updated" : "Zone created" });
      setDialogOpen(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("wsf_zones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wsf-zones"] });
      queryClient.invalidateQueries({ queryKey: ["wsf-centres"] });
      toast({ title: "Zone deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (z) => {
    setEditing(z);
    setForm({ name: z.name, description: z.description || "", is_active: z.is_active });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Zone name is required", variant: "destructive" });
    saveMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    });
  };

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <MapPin className="h-4 w-4 text-accent" /> WSF Zones
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Group WSF centres into zones for better organisation</p>
            </div>
            <Button size="sm" onClick={openNew} className="gap-1.5 w-full sm:w-auto">
              <Plus className="h-4 w-4" /> Add Zone
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : zones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No WSF zones configured</p>
          ) : (
            <div className="space-y-2">
              {zones.map(z => (
                <div key={z.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{z.name}</p>
                      {z.description && <p className="text-xs text-muted-foreground truncate">{z.description}</p>}
                    </div>
                    <Badge variant={z.is_active ? "default" : "secondary"} className="text-xs shrink-0">
                      {z.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {centreCounts[z.id] || 0} centres
                    </Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(z)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (window.confirm("Delete this zone?")) deleteMutation.mutate(z.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-display">{editing ? "Edit Zone" : "New Zone"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Zone Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. North Cardiff" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={2} />
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
    </>
  );
}
