import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Cake, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

const CHANNELS = [
  { id: "in_app", label: "In-app notification" },
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
];

const PLACEHOLDERS = ["{first_name}", "{last_name}", "{church_name}"];

export default function BirthdayMessagesSection() {
  const { tenantId, isTenantAdmin } = useTenant();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [sendingTest, setSendingTest] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["birthday_message_settings", tenantId],
    enabled: !!tenantId && isTenantAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("birthday_message_settings")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      // Auto-create defaults if missing
      if (!data) {
        const { data: created, error: insErr } = await supabase
          .from("birthday_message_settings")
          .insert({ tenant_id: tenantId })
          .select()
          .single();
        if (insErr) throw insErr;
        return created;
      }
      return data;
    },
  });

  const [draft, setDraft] = useState(null);
  const current = draft || settings;

  React.useEffect(() => {
    if (settings && !draft) setDraft(settings);
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("birthday_message_settings")
        .update({
          enabled: current.enabled,
          channels: current.channels,
          send_hour_local: current.send_hour_local,
          email_subject: current.email_subject,
          email_body: current.email_body,
          sms_template: current.sms_template,
          whatsapp_template: current.whatsapp_template,
          in_app_template: current.in_app_template,
        })
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Birthday settings saved");
      qc.invalidateQueries({ queryKey: ["birthday_message_settings", tenantId] });
    },
    onError: (err) => toast.error("Save failed", { description: err.message }),
  });

  if (!isTenantAdmin) return null;

  if (isLoading || !current) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
        </CardContent>
      </Card>
    );
  }

  const setField = (k, v) => setDraft({ ...current, [k]: v });
  const toggleChannel = (id) => {
    const next = current.channels.includes(id)
      ? current.channels.filter((c) => c !== id)
      : [...current.channels, id];
    setField("channels", next);
  };

  const sendTest = async () => {
    if (!user) return;
    setSendingTest(true);
    try {
      // Find the member row for the current user
      const { data: me } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!me) {
        toast({ title: "Couldn't find your member profile", variant: "destructive" });
        return;
      }
      // Save first so test reflects edits
      await save.mutateAsync();
      const { data, error } = await supabase.functions.invoke("send-birthday-messages", {
        body: { tenant_id: tenantId, member_id: me.id, channels: current.channels },
      });
      if (error) throw error;
      toast({
        title: "Test dispatched",
        description: `${data?.sent ?? 0} sent · ${data?.failed ?? 0} failed`,
      });
    } catch (err) {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Cake className="h-4 w-4 text-accent" /> Birthday Messages
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Automatically send birthday greetings to members on their big day. Use{" "}
          <code className="px-1 rounded bg-muted">{"{first_name}"}</code>,{" "}
          <code className="px-1 rounded bg-muted">{"{last_name}"}</code> and{" "}
          <code className="px-1 rounded bg-muted">{"{church_name}"}</code> placeholders.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label className="text-sm font-medium">Enable birthday messages</Label>
            <p className="text-[11px] text-muted-foreground">Master switch — turn off to pause all sends.</p>
          </div>
          <Switch
            checked={current.enabled}
            onCheckedChange={(v) => setField("enabled", v)}
          />
        </div>

        {/* Channels + hour */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Channels</Label>
            <div className="space-y-2 rounded-lg border p-3">
              {CHANNELS.map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <span className="text-sm">{c.label}</span>
                  <Switch
                    checked={current.channels.includes(c.id)}
                    onCheckedChange={() => toggleChannel(c.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Daily send time</Label>
            <Select
              value={String(current.send_hour_local)}
              onValueChange={(v) => setField("send_hour_local", parseInt(v, 10))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }).map((_, h) => (
                  <SelectItem key={h} value={String(h)}>
                    {String(h).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Birthday messages are dispatched once per day around this hour (UTC).
            </p>
          </div>
        </div>

        {/* Templates */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Email subject</Label>
            <Input
              value={current.email_subject}
              onChange={(e) => setField("email_subject", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Email body</Label>
            <Textarea
              rows={6}
              value={current.email_body}
              onChange={(e) => setField("email_body", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">SMS message</Label>
            <Textarea
              rows={3}
              value={current.sms_template}
              onChange={(e) => setField("sms_template", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              {current.sms_template?.length || 0} characters
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">WhatsApp message</Label>
            <Textarea
              rows={3}
              value={current.whatsapp_template}
              onChange={(e) => setField("whatsapp_template", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">In-app notification</Label>
            <Textarea
              rows={2}
              value={current.in_app_template}
              onChange={(e) => setField("in_app_template", e.target.value)}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Available placeholders: {PLACEHOLDERS.join("  ")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || JSON.stringify(draft) === JSON.stringify(settings)}
            className="gap-2"
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
          <Button
            variant="outline"
            onClick={sendTest}
            disabled={sendingTest || current.channels.length === 0}
            className="gap-2"
          >
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send test to me
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
