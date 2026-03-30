import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Send, CheckCircle, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { normalizePhone } from "@/lib/phone-utils";
import InvalidRecipientsPreview from "./InvalidRecipientsPreview";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import AudienceFilter from "@/components/comms/AudienceFilter";

export default function SMSDialog({
  open,
  onOpenChange,
  prefillMessage = "",
  prefillAudience = "",
  smsType = "bulk",
  referenceId = null,
  directRecipients = null,
  title = "Send Message",
  defaultChannel = "sms",
  unitAudiences = [],
}) {
  const { isAdmin, leaderUnits } = useAuth();
  const { tenantId, scopeQuery } = useTenantQuery();
  const { toast } = useToast();
  const [message, setMessage] = useState(prefillMessage);
  const [filters, setFilters] = useState({ status: "all", unit: "all", dateFrom: null, dateTo: null });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [channel, setChannel] = useState(defaultChannel);

  React.useEffect(() => {
    if (open) {
      setMessage(prefillMessage);
      setFilters({ status: "all", unit: "all", dateFrom: null, dateTo: null });
      setResult(null);
      setChannel(defaultChannel);
    }
  }, [open, prefillMessage, defaultChannel]);

  const { data: members = [] } = useQuery({
    queryKey: ["sms-recipients", filters.status, filters.unit, filters.dateFrom?.toISOString(), filters.dateTo?.toISOString(), directRecipients ? "direct" : "audience", tenantId],
    queryFn: async () => {
      if (directRecipients) return [];
      let query = supabase.from("members").select("id, first_name, last_name, phone, church_unit, membership_status");
      if (filters.status !== "all") query = query.eq("membership_status", filters.status);
      if (filters.unit !== "all") query = query.ilike("church_unit", `%${filters.unit}%`);
      if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom.toISOString());
      if (filters.dateTo) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }
      const { data } = await scopeQuery(query);
      return (data || []).filter(m => m.phone && m.phone.trim());
    },
    enabled: open && !directRecipients,
  });

  const { validRecipients, invalidRecipients } = useMemo(() => {
    const list = directRecipients
      ? directRecipients.filter(r => r.phone)
      : members;
    const valid = [];
    const invalid = [];
    for (const r of list) {
      const normalized = normalizePhone(r.phone);
      if (normalized) {
        valid.push({ ...r, phone: normalized });
      } else {
        invalid.push({ ...r, rawPhone: r.phone });
      }
    }
    return { validRecipients: valid, invalidRecipients: invalid };
  }, [directRecipients, members]);

  const validCount = validRecipients.length;
  const segments = Math.ceil((message.length || 1) / 160);

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: "Please enter a message", variant: "destructive" });
      return;
    }
    if (validCount === 0) {
      toast({ title: "No recipients with valid phone numbers", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const recipients = validRecipients.map(r => ({
        phone: r.phone,
        member_id: r.member_id || r.id,
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
            message: message.trim(),
            sms_type: smsType,
            reference_id: referenceId,
            channel,
            tenant_id: tenantId,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");

      setResult(data);
      toast({
        title: `${channel === "whatsapp" ? "WhatsApp" : "SMS"} Sent`,
        description: `${data.sent} sent, ${data.failed} failed out of ${data.total}`,
      });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const channelLabel = channel === "whatsapp" ? "WhatsApp" : "SMS";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 text-center py-4">
            <div className="flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-chart-3" />
                <span className="text-lg font-bold">{result.sent}</span>
                <span className="text-sm text-muted-foreground">Sent</span>
              </div>
              {result.failed > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-lg font-bold">{result.failed}</span>
                  <span className="text-sm text-muted-foreground">Failed</span>
                </div>
              )}
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">

            {!directRecipients && (
              <AudienceFilter filters={filters} onChange={setFilters} />
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Message</label>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{message.length} chars</span>
                  {channel === "sms" && (
                    <Badge variant="outline" className="text-xs">
                      {segments} segment{segments !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder={`Type your ${channelLabel} message...`}
                maxLength={1600}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valid recipients:</span>
              <Badge className="bg-primary/10 text-primary border-0">
                {validCount}
              </Badge>
            </div>

            <InvalidRecipientsPreview invalidRecipients={invalidRecipients} />

            <Button
              onClick={handleSend}
              disabled={sending || validCount === 0 || !message.trim()}
              className={`w-full ${channel === "whatsapp" ? "bg-[#25D366] hover:bg-[#1da851]" : "bg-primary"}`}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send {channelLabel} to {validCount} recipient{validCount !== 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
