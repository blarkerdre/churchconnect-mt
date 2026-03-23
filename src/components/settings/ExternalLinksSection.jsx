import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import {
  Link2, Plus, Pencil, Trash2, Loader2, ArrowUp, ArrowDown,
  Globe, BookOpen, ExternalLink, GraduationCap, Church, Wallet,
  Music, Video, FileText, Phone, Mail, Heart
} from "lucide-react";
import { ICON_OPTIONS, getIconComponent } from "@/lib/icon-map";

export default function ExternalLinksSection() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [form, setForm] = useState({ title: "", url: "", description: "", icon: "Globe" });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["app-settings", "external_links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "external_links")
        .maybeSingle();
      if (error) throw error;
      return Array.isArray(data?.value) ? data.value : [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newLinks) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "external_links", value: newLinks }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app-settings", "external_links"] }),
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditingIdx(null); setForm({ title: "", url: "", description: "", icon: "Globe" }); setDialogOpen(true); };
  const openEdit = (idx) => { setEditingIdx(idx); setForm(links[idx]); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.title.trim() || !form.url.trim()) {
      toast({ title: "Title and URL are required", variant: "destructive" });
      return;
    }
    let url = form.url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const entry = { ...form, title: form.title.trim(), url, description: form.description.trim() };

    const updated = editingIdx !== null
      ? links.map((l, i) => i === editingIdx ? entry : l)
      : [...links, entry];
    saveMutation.mutate(updated);
    toast({ title: editingIdx !== null ? "Link updated" : "Link added" });
    setDialogOpen(false);
  };

  const handleDelete = (idx) => {
    if (window.confirm(`Delete "${links[idx].title}"?`)) {
      saveMutation.mutate(links.filter((_, i) => i !== idx));
      toast({ title: "Link deleted" });
    }
  };

  const move = (idx, dir) => {
    const arr = [...links];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    saveMutation.mutate(arr);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Link2 className="h-4 w-4 text-accent" /> External Links
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Links displayed on member dashboard and sidebar for quick access to external apps</p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1.5 w-full sm:w-auto">
            <Plus className="h-4 w-4" /> Add Link
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No external links configured</p>
        ) : (
          <div className="space-y-2">
            {links.map((link, idx) => {
              const IconComp = getIconComponent(link.icon);
              return (
                <div key={idx} className="flex items-center justify-between p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <IconComp className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{link.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === links.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(idx)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingIdx !== null ? "Edit Link" : "Add External Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Online Giving" />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description" rows={2} />
            </div>
            <div>
              <Label>Icon</Label>
              <Select value={form.icon} onValueChange={(v) => setForm(f => ({ ...f, icon: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map(({ name, label }) => {
                    const IC = getIconComponent(name);
                    return (
                      <SelectItem key={name} value={name}>
                        <span className="flex items-center gap-2">
                          <IC className="h-4 w-4" /> {label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="w-full">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingIdx !== null ? "Update" : "Create"} Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
