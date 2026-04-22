import React, { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, MessageSquare, Send, Bell, MessageCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { normalizePhone } from "@/lib/phone-utils";
import { logAudit } from "@/lib/audit";
import InvalidRecipientsPreview from "@/components/sms/InvalidRecipientsPreview";

/**
 * Render personalisation tokens like {first_name} for a single recipient.
 * Allowed keys come from the `tokens` map.
 */
function applyTokens(text, tokens) {
  if (!text) return "";
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const v = tokens?.[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export default function MessageFilteredMembersDialog({
  open,
  onOpenChange,
  members = [],
  source = "report",
  audienceLabel = "filtered members",
  filterContext = {},
}) {
  const { toast } = useToast();
  const { tenantId } = useTenantQuery();
  const { user } = useAuth();

  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Recipient summaries per channel
  const summary = useMemo(() => {
    const withEmail = members.filter((m) => m.email && m.email.trim());
    const phoneList = members
      .map((m) => ({ ...m, _normPhone: normalizePhone(m.phone) }))
      .filter((m) => m._normPhone);
    const invalidPhone = members
      .filter((m) => m.phone && !normalizePhone(m.phone))
      .map((m) => ({ first_name: m.first_name, last_name: m.last_name, rawPhone: m.phone }));
    const linkedAccounts = members.filter((m) => m.user_id);
    return { withEmail, phoneList, invalidPhone, linkedAccounts };
  }, [members]);

  const reset = () => {
    setSubject("");
    setMessage("");
    setChannel("email");
  };

  const handleClose = (v) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const sendEmail = async () => {
    if (!tenantId) {
      toast({ title: "No church context", description: "Reload the page and try again.", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    if (summary.withEmail.length === 0) {
      toast({ title: "No recipients with an email address", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      // For tokens, send body as-is — server doesn't yet personalise per recipient.
      // Strip {first_name} fallback so emails read naturally.
      const cleanBody = message.replace(/\{first_name\}/g, "there");
      const { data, error } = await supabase.functions.invoke("send-email-alert", {
        body: {
          subject: subject.trim(),
          body: cleanBody,
          tenant_id: tenantId,
          member_ids: summary.withEmail.map((m) => m.id),
          audience_label: audienceLabel,
        },
      });
      if (error) throw error;
      if (data?.error && (data.sent ?? 0) === 0) {
        toast({ title: "Email", description: data.error, variant: "destructive" });
      } else {
        toast({
          title: "Emails queued",
          description: `${data?.sent ?? 0} email(s) queued${data?.skipped ? `, ${data.skipped} suppressed` : ""}.`,
        });
        await logAudit("bulk_message_sent", "members", null, {
          source,
          channel: "email",
          recipients: data?.sent ?? 0,
          audience_label: audienceLabel,
          filters: filterContext,
        }, tenantId);
        handleClose(false);
      }
    } catch (err) {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendSmsLike = async (smsChannel) => {
    if (!tenantId) {
      toast({ title: "No church context", description: "Reload the page and try again.", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Message is required", variant: "destructive" });
      return;
    }
    if (summary.phoneList.length === 0) {
      toast({ title: "No recipients with a valid phone number", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const recipients = summary.phoneList.map((m) => ({
        phone: m._normPhone,
        member_id: m.id,
      }));
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipients,
            message: message.replace(/\{first_name\}/g, "there"),
            sms_type: "bulk",
            channel: smsChannel,
            tenant_id: tenantId,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      toast({
        title: smsChannel === "whatsapp" ? "WhatsApp sent" : "SMS sent",
        description: `${data.sent} sent, ${data.failed} failed of ${data.total}.`,
      });
      await logAudit("bulk_message_sent", "members", null, {
        source,
        channel: smsChannel,
        recipients: data.sent,
        audience_label: audienceLabel,
        filters: filterContext,
      }, tenantId);
      handleClose(false);
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendInApp = async () => {
    if (!tenantId) {
      toast({ title: "No church context", description: "Reload the page and try again.", variant: "destructive" });
      return;
    }
    if (!subject.trim() || !message.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    if (summary.linkedAccounts.length === 0) {
      toast({ title: "No recipients have a linked app account", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const rows = summary.linkedAccounts.map((m) => ({
        user_id: m.user_id,
        tenant_id: tenantId,
        title: applyTokens(subject, { first_name: m.first_name, last_name: m.last_name }),
        message: applyTokens(message, { first_name: m.first_name, last_name: m.last_name }),
        type: "admin_message",
        reference_type: source,
      }));
      if (rows.some((r) => r.tenant_id !== tenantId)) throw new Error("Tenant mismatch");
      // Insert in chunks of 200 to stay well within row limits
      const chunkSize = 200;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize);
        const { error } = await supabase.from("notifications").insert(slice);
        if (error) throw error;
        inserted += slice.length;
      }
      toast({
        title: "In-app notifications sent",
        description: `${inserted} member${inserted !== 1 ? "s" : ""} notified.`,
      });
      await logAudit("bulk_message_sent", "members", null, {
        source,
        channel: "in_app",
        recipients: inserted,
        audience_label: audienceLabel,
        filters: filterContext,
      }, tenantId);
      handleClose(false);
    } catch (err) {
      toast({ title: "Failed to notify", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <TenantDialogHeader>
          <Send className="h-5 w-5 text-primary" />
          Message Filtered Members
        </TenantDialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          Sending to <strong>{members.length}</strong> member{members.length !== 1 ? "s" : ""} from <em>{audienceLabel}</em>.
          Use <code className="text-[11px]">{"{first_name}"}</code> for personalisation (in-app channel only).
        </p>

        <Tabs value={channel} onValueChange={setChannel} className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="email" className="text-xs"><Mail className="h-3.5 w-3.5 mr-1" />Email</TabsTrigger>
            <TabsTrigger value="sms" className="text-xs"><MessageSquare className="h-3.5 w-3.5 mr-1" />SMS</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs"><MessageCircle className="h-3.5 w-3.5 mr-1" />WhatsApp</TabsTrigger>
            <TabsTrigger value="in_app" className="text-xs"><Bell className="h-3.5 w-3.5 mr-1" />In-App</TabsTrigger>
          </TabsList>

          {/* EMAIL */}
          <TabsContent value="email" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Recipients with email</span>
              <Badge className="bg-primary/10 text-primary border-0">{summary.withEmail.length}</Badge>
            </div>
            <Input
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              placeholder="Write your message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
            />
            <Button
              className="w-full"
              onClick={sendEmail}
              disabled={sending || summary.withEmail.length === 0}
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send to {summary.withEmail.length} recipient{summary.withEmail.length !== 1 ? "s" : ""}
            </Button>
          </TabsContent>

          {/* SMS */}
          <TabsContent value="sms" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Recipients with valid phone</span>
              <Badge className="bg-primary/10 text-primary border-0">{summary.phoneList.length}</Badge>
            </div>
            <Textarea
              placeholder="Type your SMS..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1600}
            />
            <p className="text-[11px] text-muted-foreground text-right">{message.length} chars</p>
            <InvalidRecipientsPreview invalidRecipients={summary.invalidPhone} />
            <Button
              className="w-full"
              onClick={() => sendSmsLike("sms")}
              disabled={sending || summary.phoneList.length === 0}
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send SMS to {summary.phoneList.length}
            </Button>
          </TabsContent>

          {/* WhatsApp */}
          <TabsContent value="whatsapp" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Recipients with valid phone</span>
              <Badge className="bg-primary/10 text-primary border-0">{summary.phoneList.length}</Badge>
            </div>
            <Textarea
              placeholder="Type your WhatsApp message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={1600}
            />
            <InvalidRecipientsPreview invalidRecipients={summary.invalidPhone} />
            <Button
              className="w-full bg-[#25D366] hover:bg-[#1da851]"
              onClick={() => sendSmsLike("whatsapp")}
              disabled={sending || summary.phoneList.length === 0}
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send WhatsApp to {summary.phoneList.length}
            </Button>
          </TabsContent>

          {/* In-app */}
          <TabsContent value="in_app" className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Members with linked app account</span>
              <Badge className="bg-primary/10 text-primary border-0">{summary.linkedAccounts.length}</Badge>
            </div>
            <Input
              placeholder="Notification title"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              placeholder="Notification message... use {first_name} to personalise"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
            />
            <Button
              className="w-full"
              onClick={sendInApp}
              disabled={sending || summary.linkedAccounts.length === 0}
            >
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bell className="h-4 w-4 mr-2" />}
              Notify {summary.linkedAccounts.length} member{summary.linkedAccounts.length !== 1 ? "s" : ""}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
