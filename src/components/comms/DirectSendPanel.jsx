import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, MessageSquare, Bell, Send, Loader2, User, UserPlus, Users, Search } from "lucide-react";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone-utils";
import { logAudit } from "@/lib/audit";
import ContactsManager from "./ContactsManager";
import InvalidRecipientsPreview from "@/components/sms/InvalidRecipientsPreview";

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
);

const customSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
});

function IndividualSend({ tenantId, churchName, senderName }) {
  const { toast } = useToast();
  const [mode, setMode] = useState("search"); // "search" | "custom"
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null); // {type, id?, first_name, last_name, email, phone, user_id?}
  const [custom, setCustom] = useState({ name: "", email: "", phone: "" });
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["direct-search", tenantId, query],
    queryFn: async () => {
      const q = query.trim();
      if (q.length < 2) return [];
      const like = `%${q}%`;
      const out = [];
      const { data: mem } = await supabase
        .from("members")
        .select("id, user_id, first_name, last_name, email, phone")
        .eq("tenant_id", tenantId)
        .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(8);
      (mem || []).forEach(m => out.push({ ...m, type: "member" }));
      const { data: ft } = await supabase
        .from("first_timers")
        .select("id, first_name, last_name, email, phone")
        .eq("tenant_id", tenantId)
        .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(8);
      (ft || []).forEach(m => out.push({ ...m, type: "first_timer" }));
      const { data: ct } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone")
        .eq("tenant_id", tenantId)
        .or(`first_name.ilike.${like},last_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
        .limit(8);
      (ct || []).forEach(m => out.push({ ...m, type: "contact" }));
      return out;
    },
    enabled: !!tenantId && mode === "search" && query.trim().length >= 2,
  });

  const recipient = useMemo(() => {
    if (mode === "custom") {
      return {
        type: "custom",
        first_name: custom.name || "Friend",
        last_name: "",
        email: custom.email || null,
        phone: custom.phone || null,
        user_id: null,
      };
    }
    return picked;
  }, [mode, custom, picked]);

  const channelDisabled = (ch) => {
    if (!recipient) return true;
    if (ch === "email") return !recipient.email;
    if (ch === "sms" || ch === "whatsapp") return !recipient.phone;
    if (ch === "in_app") return !(recipient.type === "member" && recipient.user_id);
    return false;
  };

  const handleSend = async () => {
    if (mode === "custom") {
      const parsed = customSchema.safeParse(custom);
      if (!parsed.success) {
        toast({ title: "Invalid recipient", description: parsed.error.issues[0]?.message, variant: "destructive" });
        return;
      }
    }
    if (!recipient || channelDisabled(channel)) {
      toast({ title: "Recipient missing required contact info for this channel", variant: "destructive" });
      return;
    }
    if (channel === "email" && !subject.trim()) {
      toast({ title: "Subject required", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Message required", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      if (channel === "email") {
        const { error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "admin-direct-message",
            recipientEmail: recipient.email,
            tenant_id: tenantId,
            idempotencyKey: `direct-${tenantId}-${Date.now()}-${recipient.email}`,
            templateData: {
              recipientName: recipient.first_name || "Friend",
              churchName,
              subject: subject.trim(),
              body: message.trim(),
              senderName,
            },
          },
        });
        if (error) throw error;
        toast({ title: "Email sent" });
      } else if (channel === "sms" || channel === "whatsapp") {
        const normalized = normalizePhone(recipient.phone);
        if (!normalized) throw new Error("Invalid phone number");
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            recipients: [{ phone: normalized, member_id: recipient.type === "member" ? recipient.id : null }],
            message: message.trim(),
            sms_type: "direct",
            reference_id: null,
            channel,
            tenant_id: tenantId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Send failed");
        toast({ title: `${channel === "whatsapp" ? "WhatsApp" : "SMS"} sent` });
      } else if (channel === "in_app") {
        const { error } = await supabase.from("notifications").insert({
          user_id: recipient.user_id,
          tenant_id: tenantId,
          title: subject.trim() || "New message",
          message: message.trim(),
          type: "admin_message",
          reference_type: "direct",
        });
        if (error) throw error;
        toast({ title: "In-app notification sent" });
      }
      await logAudit("direct_message_sent", "members", recipient.id || null, {
        channel, recipient_type: recipient.type, mode: "individual",
      }, tenantId);
      setSubject(""); setMessage("");
    } catch (e) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={mode === "search" ? "default" : "outline"} size="sm" onClick={() => setMode("search")}>
          <Search className="h-3.5 w-3.5 mr-1.5" /> Search directory
        </Button>
        <Button variant={mode === "custom" ? "default" : "outline"} size="sm" onClick={() => setMode("custom")}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Custom recipient
        </Button>
      </div>

      {mode === "search" ? (
        <div className="space-y-2">
          <Input placeholder="Search members, first-timers, contacts..." value={query} onChange={e => { setQuery(e.target.value); setPicked(null); }} />
          {query.trim().length >= 2 && !picked && (
            <div className="border rounded-lg max-h-56 overflow-y-auto divide-y">
              {searchResults.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">No matches</p>
              ) : searchResults.map((r, i) => (
                <button key={`${r.type}-${r.id}-${i}`} onClick={() => { setPicked(r); setQuery(""); }} className="w-full text-left p-2.5 hover:bg-muted/50 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{`${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || r.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">{[r.email, r.phone].filter(Boolean).join(" • ")}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{r.type.replace("_", " ")}</Badge>
                </button>
              ))}
            </div>
          )}
          {picked && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{`${picked.first_name || ""} ${picked.last_name || ""}`.trim() || picked.email || picked.phone}</p>
                  <p className="text-xs text-muted-foreground truncate">{[picked.email, picked.phone].filter(Boolean).join(" • ")}</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">{picked.type.replace("_", " ")}</Badge>
                <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>Change</Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input placeholder="Name (optional)" value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))} />
          <Input type="email" placeholder="Email" value={custom.email} onChange={e => setCustom(c => ({ ...c, email: e.target.value }))} />
          <Input placeholder="Phone (E.164, e.g. +44...)" value={custom.phone} onChange={e => setCustom(c => ({ ...c, phone: e.target.value }))} />
        </div>
      )}

      <div>
        <label className="text-sm font-medium block mb-1">Channel</label>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="email" disabled={channelDisabled("email")}>Email</SelectItem>
            <SelectItem value="sms" disabled={channelDisabled("sms")}>SMS</SelectItem>
            <SelectItem value="whatsapp" disabled={channelDisabled("whatsapp")}>WhatsApp</SelectItem>
            <SelectItem value="in_app" disabled={channelDisabled("in_app")}>In-App (members only)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(channel === "email" || channel === "in_app") && (
        <Input placeholder={channel === "email" ? "Subject" : "Title"} value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} />
      )}
      <Textarea rows={5} placeholder="Message..." value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} />

      <Button onClick={handleSend} disabled={sending || !recipient || channelDisabled(channel)} className="w-full">
        {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        Send
      </Button>
    </div>
  );
}

function BulkNonMembers({ tenantId, churchName, senderName }) {
  const { toast } = useToast();
  const [source, setSource] = useState("both"); // contacts | first_timers | both
  const [tag, setTag] = useState("all");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ["bulk-contacts", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("*").eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const { data: firstTimers = [] } = useQuery({
    queryKey: ["bulk-first-timers", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("first_timers").select("id, first_name, last_name, email, phone").eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: !!tenantId,
  });

  const allTags = useMemo(() => {
    const s = new Set();
    contacts.forEach(c => (c.tags || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [contacts]);

  const pool = useMemo(() => {
    let list = [];
    if (source === "contacts" || source === "both") {
      let cs = contacts;
      if (tag !== "all") cs = cs.filter(c => (c.tags || []).includes(tag));
      list = list.concat(cs);
    }
    if (source === "first_timers" || source === "both") {
      list = list.concat(firstTimers);
    }
    return list;
  }, [source, tag, contacts, firstTimers]);

  const { emailRecipients, phoneValid, phoneInvalid } = useMemo(() => {
    const er = pool.filter(p => p.email && p.email.trim());
    const pv = [];
    const pi = [];
    for (const p of pool) {
      if (!p.phone) continue;
      const n = normalizePhone(p.phone);
      if (n) pv.push({ ...p, phone: n });
      else pi.push({ first_name: p.first_name, last_name: p.last_name, rawPhone: p.phone });
    }
    return { emailRecipients: er, phoneValid: pv, phoneInvalid: pi };
  }, [pool]);

  const targetCount = channel === "email" ? emailRecipients.length : phoneValid.length;

  const handleSend = async () => {
    if (!message.trim()) { toast({ title: "Message required", variant: "destructive" }); return; }
    if (channel === "email" && !subject.trim()) { toast({ title: "Subject required", variant: "destructive" }); return; }
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
                idempotencyKey: `bulk-${tenantId}-${Date.now()}-${r.email}`,
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
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            recipients: phoneValid.map(r => ({ phone: r.phone, member_id: null })),
            message: message.trim(),
            sms_type: "bulk_nonmember",
            reference_id: null,
            channel,
            tenant_id: tenantId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Send failed");
        sent = data.sent || 0;
        failed = data.failed || 0;
      }
      await logAudit("direct_message_sent", "contacts", null, { channel, mode: "bulk_nonmember", source, sent, failed }, tenantId);
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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Source</label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="contacts">Contacts</SelectItem>
              <SelectItem value="first_timers">First Timers</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Contact tag</label>
          <Select value={tag} onValueChange={setTag} disabled={source === "first_timers"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium block mb-1">Channel</label>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {channel === "email" && (
        <Input placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} />
      )}
      <Textarea rows={5} placeholder="Message..." value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Recipients ({channel}):</span>
        <Badge className="bg-primary/10 text-primary border-0">{targetCount}</Badge>
      </div>

      {channel !== "email" && <InvalidRecipientsPreview invalidRecipients={phoneInvalid} />}

      <Button onClick={handleSend} disabled={sending || targetCount === 0} className="w-full">
        {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        Send to {targetCount} {targetCount === 1 ? "recipient" : "recipients"}
      </Button>
    </div>
  );
}

export default function DirectSendPanel({ churchName, senderName }) {
  const { tenantId } = useTenantQuery();
  return (
    <Tabs defaultValue="individual" className="space-y-4">
      <TabsList className="grid grid-cols-3">
        <TabsTrigger value="individual" className="gap-1.5 text-xs"><User className="h-3.5 w-3.5" /> Individual</TabsTrigger>
        <TabsTrigger value="bulk" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Bulk Non-Members</TabsTrigger>
        <TabsTrigger value="manage" className="gap-1.5 text-xs"><UserPlus className="h-3.5 w-3.5" /> Manage Contacts</TabsTrigger>
      </TabsList>
      <TabsContent value="individual"><IndividualSend tenantId={tenantId} churchName={churchName} senderName={senderName} /></TabsContent>
      <TabsContent value="bulk"><BulkNonMembers tenantId={tenantId} churchName={churchName} senderName={senderName} /></TabsContent>
      <TabsContent value="manage"><ContactsManager /></TabsContent>
    </Tabs>
  );
}
