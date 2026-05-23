import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Send, Plus, Pencil, Trash2, Loader2, Mail, MessageSquare, Clock } from "lucide-react";
import PasswordConfirmDialog from "@/components/shared/PasswordConfirmDialog";

const FOLLOWUP_TYPES = ["First Timer", "New Convert", "Visitor"];
const CHANNELS = [
  { value: "sms", label: "SMS", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
];

const DEFAULT_TEMPLATES = [
  { followup_type: "First Timer", channel: "sms", subject: null, message_template: "Hi {name}, thank you for visiting {church}! We'd love to see you again this Sunday.", delay_hours: 24, sort_order: 0 },
  { followup_type: "First Timer", channel: "email", subject: "Welcome to {church}!", message_template: "Hi {name},\n\nThank you for visiting {church}! We are so glad you joined us. We'd love to see you again this Sunday.\n\nWarm regards,\nThe {church} Team", delay_hours: 24, sort_order: 1 },
  { followup_type: "New Convert", channel: "sms", subject: null, message_template: "Hi {name}, congratulations on your new journey of faith at {church}! We'd love to help you get connected. Have you considered joining our Believers Foundation Class?", delay_hours: 24, sort_order: 0 },
  { followup_type: "New Convert", channel: "email", subject: "Welcome to the family - {church}", message_template: "Hi {name},\n\nCongratulations on your decision! We are thrilled to welcome you to the {church} family.\n\nWe'd love to help you grow in your faith. Please consider enrolling in our Believers Foundation Class.\n\nGod bless,\nThe {church} Team", delay_hours: 24, sort_order: 1 },
  { followup_type: "Visitor", channel: "sms", subject: null, message_template: "Hi {name}, thank you for worshipping with us at {church}! We hope you felt at home. We'd love to see you again.", delay_hours: 24, sort_order: 0 },
  { followup_type: "Visitor", channel: "email", subject: "Thank you for visiting {church}", message_template: "Hi {name},\n\nThank you for worshipping with us at {church}! We hope you felt at home and would love to see you again.\n\nWarm regards,\nThe {church} Team", delay_hours: 24, sort_order: 1 },
];

export default function FollowupTemplatesSection() {
  const { tenantId, withTenant, scopeQuery } = useTenantQuery();
  const qc = useQueryClient();
  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["followup-message-templates", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("followup_message_templates").select("*").order("followup_type").order("sort_order")
      );
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const rows = DEFAULT_TEMPLATES.map(t => withTenant({ ...t, is_active: true }));
      const { error } = await supabase.from("followup_message_templates").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followup-message-templates"] });
      toast({ title: "Default templates created" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async (item) => {
      if (item.id) {
        const { error } = await supabase.from("followup_message_templates")
          .update({ ...item, updated_at: new Date().toISOString() })
          .eq("id", item.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("followup_message_templates")
          .insert(withTenant(item));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followup-message-templates"] });
      toast({ title: "Template saved" });
      setEditDialog(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from("followup_message_templates").delete().eq("id", id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["followup-message-templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from("followup_message_templates")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followup-message-templates"] }),
  });

  const openNew = () => {
    setEditItem({ followup_type: "First Timer", channel: "sms", subject: "", message_template: "", delay_hours: 24, sort_order: 0 });
    setEditDialog(true);
  };

  const openEdit = (t) => {
    setEditItem({ ...t });
    setEditDialog(true);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Automated Follow-up Messages
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Configure automated SMS/email messages sent to First Timers, New Converts, and Visitors when they register.
            Use <code className="bg-muted px-1 rounded">{"{name}"}</code> and <code className="bg-muted px-1 rounded">{"{church}"}</code> as placeholders.
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
              Load Defaults
            </Button>
          )}
          <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> Add</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {FOLLOWUP_TYPES.map(type => {
          const group = templates.filter(t => t.followup_type === type);
          if (group.length === 0) return null;
          return (
            <div key={type}>
              <h3 className="text-sm font-semibold text-foreground mb-2">{type}</h3>
              <div className="space-y-2">
                {group.map(t => (
                  <div key={t.id} className="flex items-start gap-3 bg-muted/50 rounded-lg p-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {t.channel === "email" ? <Mail className="h-3.5 w-3.5 text-muted-foreground" /> : <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Badge variant="secondary" className="text-[10px]">{t.channel.toUpperCase()}</Badge>
                        <Badge variant="outline" className="text-[10px]"><Clock className="h-2.5 w-2.5 mr-0.5" /> {t.delay_hours}h</Badge>
                        {!t.is_active && <Badge variant="destructive" className="text-[10px]">Disabled</Badge>}
                      </div>
                      {t.subject && <p className="text-xs font-medium text-foreground">Subject: {t.subject}</p>}
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.message_template}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={t.is_active}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: t.id, is_active: v })}
                        className="scale-75"
                      />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No templates configured. Click "Load Defaults" to get started.</p>
        )}
      </CardContent>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Follow-up Type</Label>
                  <Select value={editItem.followup_type} onValueChange={v => setEditItem(p => ({ ...p, followup_type: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FOLLOWUP_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Channel</Label>
                  <Select value={editItem.channel} onValueChange={v => setEditItem(p => ({ ...p, channel: v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Delay (hours after registration)</Label>
                <Input type="number" min={0} max={8760} value={editItem.delay_hours}
                  onChange={e => setEditItem(p => ({ ...p, delay_hours: parseInt(e.target.value) || 0 }))}
                  className="h-9 text-sm" />
              </div>
              {editItem.channel === "email" && (
                <div className="space-y-1.5">
                  <Label className="text-sm">Subject</Label>
                  <Input value={editItem.subject || ""} onChange={e => setEditItem(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Email subject..." className="h-9 text-sm" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm">Message Template</Label>
                <Textarea value={editItem.message_template} onChange={e => setEditItem(p => ({ ...p, message_template: e.target.value }))}
                  rows={5} className="text-sm resize-none" placeholder="Hi {name}, thank you for visiting {church}..." />
                <p className="text-[10px] text-muted-foreground">Placeholders: {"{name}"} = member name, {"{church}"} = church name</p>
              </div>
              <Button className="w-full" onClick={() => saveMutation.mutate(editItem)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                {editItem.id ? "Update Template" : "Create Template"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
