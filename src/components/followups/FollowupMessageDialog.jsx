import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare, Send, Clock, Loader2, PhoneCall } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";

const MESSAGE_TEMPLATES = {
  "First Timer": (name, church) =>
    `Hi ${name}, thank you for visiting ${church}! We'd love to see you again this Sunday. If you have any questions, please don't hesitate to reach out.`,
  "New Convert": (name, church) =>
    `Hi ${name}, congratulations on your new journey of faith at ${church}! We'd love to help you get connected. Have you considered joining our Believers Foundation Class?`,
  "Pastoral": (name, church) =>
    `Hi ${name}, we're reaching out from ${church} to check in on you. Please let us know if there's anything we can help with.`,
  "Absentee": (name, church) =>
    `Hi ${name}, we've missed you at ${church}! We hope you're doing well. We'd love to see you again soon.`,
  "General": (name, church) =>
    `Hi ${name}, this is a follow-up message from ${church}. We hope to connect with you soon!`,
};

export default function FollowupMessageDialog({
  open,
  onOpenChange,
  followup,
  existingMessage = null,
  onSaved,
}) {
  const { tenantId, withTenant } = useTenantQuery();
  const { user } = useAuth();

  const hasPhone = !!followup?.person_phone;
  const hasEmail = !!followup?.person_email;

  const [channel, setChannel] = useState(hasEmail ? "email" : "sms");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sendMode, setSendMode] = useState("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existingMessage) {
      setChannel(existingMessage.channel);
      setSubject(existingMessage.subject || "");
      setMessage(existingMessage.message || "");
      setSendMode(existingMessage.scheduled_at ? "schedule" : "now");
      setScheduledAt(existingMessage.scheduled_at?.slice(0, 16) || "");
    } else {
      const ch = hasEmail ? "email" : "sms";
      setChannel(ch);
      const type = followup?.category || followup?.followup_type || "General";
      const name = followup?.person_name || "there";
      const tmpl = MESSAGE_TEMPLATES[type] || MESSAGE_TEMPLATES["General"];
      setMessage(tmpl(name, "our church"));
      setSubject(ch === "email" ? `Follow-up from our church` : "");
      setSendMode("now");
      setScheduledAt("");
    }
  }, [open, followup, existingMessage, hasEmail, hasPhone]);

  const handleSave = async () => {
    if (!message.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }
    if (channel === "sms" && !hasPhone) {
      toast({ title: "No phone number available", variant: "destructive" });
      return;
    }
    if (channel === "email" && !hasEmail) {
      toast({ title: "No email address available", variant: "destructive" });
      return;
    }
    if (sendMode === "schedule" && !scheduledAt) {
      toast({ title: "Please select a schedule date/time", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        followup_id: followup.id,
        member_id: followup.member_id || null,
        channel,
        recipient_phone: followup.person_phone || null,
        recipient_email: followup.person_email || null,
        recipient_name: followup.person_name || null,
        subject: channel === "email" ? subject : null,
        message: message.trim(),
        status: sendMode === "now" ? "scheduled" : "scheduled",
        scheduled_at: sendMode === "now" ? new Date().toISOString() : new Date(scheduledAt).toISOString(),
        created_by: user?.id,
      };

      if (existingMessage?.id) {
        const { error } = await supabase
          .from("followup_scheduled_messages")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", existingMessage.id)
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("followup_scheduled_messages")
          .insert(withTenant(payload));
        if (error) throw error;
      }

      toast({ title: sendMode === "now" ? "Message queued for sending" : "Message scheduled" });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <TenantDialogHeader>
            {channel === "email" ? <Mail className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            {existingMessage ? "Edit Message" : "Send Follow-up Message"}
          </TenantDialogHeader>
        <DialogDescription>
            {followup?.person_name && (
              <span>To: <strong>{followup.person_name}</strong></span>
            )}
          </DialogDescription>

        <div className="space-y-4">
          {/* Channel selector */}
          {(hasPhone || hasEmail) && (
            <div className="space-y-1.5">
              <Label className="text-sm">Channel</Label>
              <div className="flex gap-2 flex-wrap">
                {hasEmail && (
                  <Button
                    type="button"
                    size="sm"
                    variant={channel === "email" ? "default" : "outline"}
                    onClick={() => setChannel("email")}
                  >
                    <Mail className="h-3.5 w-3.5 mr-1" /> Email
                  </Button>
                )}
                {hasPhone && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant={channel === "sms" ? "default" : "outline"}
                      onClick={() => setChannel("sms")}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" /> SMS
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={channel === "phone" ? "default" : "outline"}
                      onClick={() => setChannel("phone")}
                    >
                      <PhoneCall className="h-3.5 w-3.5 mr-1" /> Call
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {!hasPhone && !hasEmail && (
            <p className="text-sm text-destructive">No contact information available for this person.</p>
          )}

          {/* Recipient info */}
          <div className="text-xs text-muted-foreground">
            {channel === "email" && hasEmail && <span>To: {followup?.person_email}</span>}
            {channel === "sms" && hasPhone && <span>To: {followup?.person_phone}</span>}
          </div>

          {/* Subject (email only) */}
          {channel === "email" && (
            <div className="space-y-1.5">
              <Label className="text-sm">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject..." />
            </div>
          )}

          {/* Message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Message</Label>
              {channel === "sms" && (
                <Badge variant="secondary" className="text-xs">
                  {message.length}/1600
                </Badge>
              )}
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="text-sm resize-none"
              placeholder="Type your message..."
              maxLength={channel === "sms" ? 1600 : undefined}
            />
          </div>

          {/* Send mode */}
          <div className="space-y-1.5">
            <Label className="text-sm">When to send</Label>
            <Select value={sendMode} onValueChange={setSendMode}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">
                  <span className="flex items-center gap-1.5"><Send className="h-3.5 w-3.5" /> Send Now</span>
                </SelectItem>
                <SelectItem value="schedule">
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Schedule</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sendMode === "schedule" && (
            <div className="space-y-1.5">
              <Label className="text-sm">Schedule date & time</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || (!hasPhone && !hasEmail)}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : sendMode === "now" ? (
              <Send className="h-4 w-4 mr-2" />
            ) : (
              <Clock className="h-4 w-4 mr-2" />
            )}
            {saving ? "Saving..." : sendMode === "now" ? "Send Now" : "Schedule Message"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
