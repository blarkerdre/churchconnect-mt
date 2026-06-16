import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { normalizePhone } from "@/lib/phone-utils";
import { logAudit } from "@/lib/audit";
import InvalidRecipientsPreview from "@/components/sms/InvalidRecipientsPreview";
import AudienceFilter from "./AudienceFilter";

export default function BulkMembersPanel({ churchName, senderName }) {
  const { tenantId } = useTenantQuery();
  const { toast } = useToast();
  const [filters, setFilters] = useState({ status: "all", unit: "all", gender: "all", wsfCentreId: "all", dateFrom: null, dateTo: null, account: "all" });
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["bulk-members", tenantId, filters],
    queryFn: async () => {
      let q = supabase
        .from("members")
        .select("id, user_id, first_name, last_name, email, phone")
        .eq("tenant_id", tenantId);
      if (filters.status !== "all") q = q.eq("membership_status", filters.status);
      if (filters.unit !== "all") q = q.ilike("church_unit", `%${filters.unit}%`);
      if (filters.gender !== "all") q = q.eq("gender", filters.gender);
      if (filters.wsfCentreId !== "all") q = q.eq("wsf_centre_id", filters.wsfCentreId);
      if (filters.dateFrom) q = q.gte("created_at", filters.dateFrom.toISOString());
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      if (filters.account === "linked") q = q.not("user_id", "is", null);
      if (filters.account === "unlinked") q = q.is("user_id", null);
      const { data, error } = await q.limit(5000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { emailRecipients, phoneValid, phoneInvalid, inAppRecipients } = useMemo(() => {
    const er = members.filter(m => m.email && m.email.trim());
    const pv = []; const pi = [];
    for (const m of members) {
      if (!m.phone) continue;
      const n = normalizePhone(m.phone);
      if (n) pv.push({ ...m, phone: n });
      else pi.push({ first_name: m.first_name, last_name: m.last_name, rawPhone: m.phone });
    }
    const ia = members.filter(m => m.user_id);
    return { emailRecipients: er, phoneValid: pv, phoneInvalid: pi, inAppRecipients: ia };
  }, [members]);

  const targetCount = channel === "email" ? emailRecipients.length
    : channel === "in_app" ? inAppRecipients.length
    : phoneValid.length;

  const handleSend = async () => {
    if (!message.trim()) { toast({ title: "Message required", variant: "destructive" }); return; }
    if ((channel === "email" || channel === "in_app") && !subject.trim()) {
      toast({ title: channel === "email" ? "Subject required" : "Title required", variant: "destructive" }); return;
    }
    if (targetCount === 0) { toast({ title: "No valid recipients", variant: "destructive" }); return; }

    setSending(true);
    let sent = 0; let failed = 0;
    try {
      if (channel === "email") {
        for (const r of emailRecipients) {
          try {
            const { error } = await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "admin-direct-message",
                recipientEmail: r.email,
                tenant_id: tenantId,
                idempotencyKey: `bulkmem-${tenantId}-${Date.now()}-${r.id}`,
                templateData: {
                  recipientName: r.first_name || "Friend",
                  churchName,
                  subject: subject.trim(),
                  body: message.trim(),
                  senderName,
                },
              },
            });
            if (error) throw error;
            sent++;
          } catch { failed++; }
        }
      } else if (channel === "sms" || channel === "whatsapp") {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            recipients: phoneValid.map(r => ({ phone: r.phone, member_id: r.id })),
            message: message.trim(),
            sms_type: "bulk_member",
            reference_id: null,
            channel,
            tenant_id: tenantId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Send failed");
        sent = data.sent || 0;
        failed = data.failed || 0;
      } else if (channel === "in_app") {
        const rows = inAppRecipients.map(r => ({
          user_id: r.user_id,
          tenant_id: tenantId,
          title: subject.trim() || "New message",
          message: message.trim(),
          type: "admin_message",
          reference_type: "direct",
        }));
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const { error } = await supabase.from("notifications").insert(rows.slice(i, i + CHUNK));
          if (error) failed += Math.min(CHUNK, rows.length - i);
          else sent += Math.min(CHUNK, rows.length - i);
        }
      }
      await logAudit("direct_message_sent", "members", null, { mode: "bulk_members", channel, filters, sent, failed }, tenantId);
      toast({ title: "Send complete", description: `${sent} sent${failed ? `, ${failed} failed` : ""}.` });
      setMessage(""); setSubject("");
    } catch (e) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <AudienceFilter filters={filters} onChange={setFilters} />

      <div>
        <label className="text-sm font-medium block mb-1">Channel</label>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="in_app">In-App</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(channel === "email" || channel === "in_app") && (
        <Input placeholder={channel === "email" ? "Subject" : "Title"} value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} />
      )}
      <Textarea rows={5} placeholder="Message..." value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Recipients ({channel}):</span>
        <Badge className="bg-primary/10 text-primary border-0">{targetCount}</Badge>
      </div>

      {(channel === "sms" || channel === "whatsapp") && <InvalidRecipientsPreview invalidRecipients={phoneInvalid} />}

      <Button onClick={handleSend} disabled={sending || targetCount === 0} className="w-full">
        {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        Send to {targetCount} {targetCount === 1 ? "recipient" : "recipients"}
      </Button>
    </div>
  );
}
