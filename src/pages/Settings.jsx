import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Settings as SettingsIcon, Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";

export default function Settings() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitName, setUnitName] = useState("");
  const [unitActive, setUnitActive] = useState(true);

  const { data: units = [], isLoading } = useQuery({
    queryKey: ["church-units", false],
    queryFn: async () => {
      const { data, error } = await supabase.from("church_units").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, name, is_active }) => {
      if (id) {
        const { error } = await supabase.from("church_units").update({ name, is_active }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("church_units").insert({ name, is_active });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["church-units"] });
      toast({ title: editingUnit ? "Unit updated" : "Unit created" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("church_units").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["church-units"] });
      toast({ title: "Unit deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditingUnit(null);
    setUnitName("");
    setUnitActive(true);
    setDialogOpen(true);
  };

  const openEdit = (unit) => {
    setEditingUnit(unit);
    setUnitName(unit.name);
    setUnitActive(unit.is_active);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingUnit(null);
    setUnitName("");
    setUnitActive(true);
  };

  const handleSave = () => {
    if (!unitName.trim()) {
      toast({ title: "Unit name is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ id: editingUnit?.id, name: unitName.trim(), is_active: unitActive });
  };

  const handleDelete = (unit) => {
    if (window.confirm(`Delete "${unit.name}"? Members assigned to this unit will retain the text value but it won't appear in selections.`)) {
      deleteMutation.mutate(unit.id);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-primary" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage application configuration</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> Church Units
            </CardTitle>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Unit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No church units configured</p>
          ) : (
            <div className="space-y-2">
              {units.map((unit) => (
                <div key={unit.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{unit.name}</span>
                    <Badge variant={unit.is_active ? "default" : "secondary"} className="text-xs">
                      {unit.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(unit)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(unit)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Edit Unit" : "Add Church Unit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Unit Name</Label>
              <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. Choir" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={unitActive} onCheckedChange={setUnitActive} />
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingUnit ? "Update" : "Create"} Unit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
