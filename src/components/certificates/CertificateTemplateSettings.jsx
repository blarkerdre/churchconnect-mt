import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Award, Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";

const emptyTemplate = {
  training_type: "",
  church_name: "Winners Chapel International Cardiff",
  signatory_name: "",
  signatory_title: "",
  background_color: "#1a2d4d",
  accent_color: "#c5a028",
  custom_message: "This is to certify that the above named has successfully completed",
};

export default function CertificateTemplateSettings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyTemplate);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificate_templates")
        .select("*")
        .order("training_type");
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      if (editing) {
        const { error } = await supabase
          .from("certificate_templates")
          .update(values)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("certificate_templates")
          .insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
      toast({ title: editing ? "Template updated" : "Template created" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("certificate_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyTemplate); setDialogOpen(true); };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      training_type: t.training_type,
      church_name: t.church_name,
      signatory_name: t.signatory_name,
      signatory_title: t.signatory_title,
      background_color: t.background_color,
      accent_color: t.accent_color,
      custom_message: t.custom_message || "",
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyTemplate); };

  const handleSave = () => {
    if (!form.training_type.trim()) {
      toast({ title: "Training type is required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      training_type: form.training_type.trim(),
      church_name: form.church_name,
      signatory_name: form.signatory_name,
      signatory_title: form.signatory_title,
      background_color: form.background_color,
      accent_color: form.accent_color,
      custom_message: form.custom_message || null,
    });
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Award className="h-4 w-4 text-accent" /> Certificate Templates
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Customize certificate appearance per training type
            </p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Template
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No custom templates. Default branding will be used for certificates.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: t.background_color }} />
                    <div className="h-4 w-4 rounded-full border" style={{ backgroundColor: t.accent_color }} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">{t.training_type}</span>
                    {t.signatory_name && (
                      <p className="text-xs text-muted-foreground">Signed by {t.signatory_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => window.confirm(`Delete template for "${t.training_type}"?`) && deleteMutation.mutate(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "Add Certificate Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Training Type *</Label>
              <Input
                value={form.training_type}
                onChange={(e) => set("training_type", e.target.value)}
                placeholder="e.g. Believers Foundation Class (BFC)"
                disabled={!!editing}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Church Name</Label>
              <Input value={form.church_name} onChange={(e) => set("church_name", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Signatory Name</Label>
                <Input value={form.signatory_name} onChange={(e) => set("signatory_name", e.target.value)} placeholder="e.g. Pastor Name" />
              </div>
              <div className="space-y-1.5">
                <Label>Signatory Title</Label>
                <Input value={form.signatory_title} onChange={(e) => set("signatory_title", e.target.value)} placeholder="e.g. Senior Pastor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Background Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.background_color} onChange={(e) => set("background_color", e.target.value)} className="h-9 w-9 rounded cursor-pointer border" />
                  <Input value={form.background_color} onChange={(e) => set("background_color", e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="h-9 w-9 rounded cursor-pointer border" />
                  <Input value={form.accent_color} onChange={(e) => set("accent_color", e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Custom Message</Label>
              <Textarea
                value={form.custom_message}
                onChange={(e) => set("custom_message", e.target.value)}
                placeholder="This is to certify that..."
                rows={2}
              />
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Update" : "Create"} Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
