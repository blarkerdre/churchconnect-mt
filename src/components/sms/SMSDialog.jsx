import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Send, CheckCircle, XCircle, Clock, CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { normalizePhone } from "@/lib/phone-utils";
import InvalidRecipientsPreview from "./InvalidRecipientsPreview";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import AudienceFilter from "@/components/comms/AudienceFilter";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const { user } = useAuth();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();
  const { toast } = useToast();
  const [message, setMessage] = useState(prefillMessage);
  const [filters, setFilters] = useState({ status: "all", unit: "all", dateFrom: null, dateTo: null });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [channel, setChannel] = useState(defaultChannel);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [scheduleTime, setScheduleTime] = useState("09:00");

  React.useEffect(() => {
    if (open) {
      setMessage(prefillMessage);
      setFilters({ status: "all", unit: "all", dateFrom: null, dateTo: null });
      setResult(null);
      setChannel(defaultChannel);
      setScheduleMode(false);
      setScheduleDate(null);
      setScheduleTime("09:00");
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
    const list = directRecipients ? directRecipients.filter(r => r.phone) : members;
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

    if (scheduleMode) {
      if (!scheduleDate) {
        toast({ title: "Please select a date", variant: "destructive" });
        return;
      }
      setSending(true);
      try {
        const [hours, minutes] = scheduleTime.split(":").map(Number);
        const scheduledAt = new Date(scheduleDate);
        scheduledAt.setHours(hours, minutes, 0, 0);

        if (scheduledAt <= new Date()) {
          toast({ title: "Scheduled time must be in the future", variant: "destructive" });
          setSending(false);
          return;
        }

        const { error } = await supabase.from("scheduled_communications").insert(withTenant({
          channel,
          filters: {
            status: filters.status !== "all" ? filters.status : null,
            unit: filters.unit !== "all" ? filters.unit : null,
            dateFrom: filters.dateFrom ? filters.dateFrom.toISOString() : null,
            dateTo: filters.dateTo ? new Date(filters.dateTo.getFullYear(), filters.dateTo.getMonth(), filters.dateTo.getDate(), 23, 59, 59, 999).toISOString() : null,
          },
          message: message.trim(),
          scheduled_at: scheduledAt.toISOString(),
          created_by: user?.id,
        }));

        if (error) throw error;
        toast({ title: `${channel === "whatsapp" ? "WhatsApp" : "SMS"} scheduled`, description: `Will be sent on ${format(scheduledAt, "dd MMM yyyy 'at' HH:mm")}` });
        onOpenChange(false);
      } catch (err) {
        toast({ title: "Failed to schedule", description: err.message, variant: "destructive" });
      } finally {
        setSending(false);
      }
      return;
    }

    // Pre-send quota check
    try {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("sms_limit_monthly, whatsapp_limit_monthly")
        .eq("id", tenantId)
        .single();

      const limitField = channel === "whatsapp" ? "whatsapp_limit_monthly" : "sms_limit_monthly";
      const quota = tenant?.[limitField] || 0;

      if (quota > 0) {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from("sms_log")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("channel", channel)
          .eq("status", "sent")
          .gte("created_at", monthStart.toISOString());

        const remaining = quota - (count || 0);
        if (validCount > remaining) {
          toast({
            title: `${channel === "whatsapp" ? "WhatsApp" : "SMS"} quota exceeded`,
            description: `You have ${Math.max(remaining, 0)} messages remaining this month (limit: ${quota}). Trying to send ${validCount}.`,
            variant: "destructive",
          });
          return;
        }
      }
    } catch (err) {
      // Non-blocking — edge function will also enforce
      console.warn("Quota pre-check failed:", err);
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
        <TenantDialogHeader>
            <MessageSquare className="h-5 w-5 text-primary" />
            {title}
          </TenantDialogHeader>

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

            {/* Schedule toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium text-foreground flex-1">Schedule for later</label>
              <Switch checked={scheduleMode} onCheckedChange={setScheduleMode} />
            </div>

            {scheduleMode && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal", !scheduleDate && "text-muted-foreground")}>
                        <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                        {scheduleDate ? format(scheduleDate, "dd MMM yyyy") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduleDate}
                        onSelect={setScheduleDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Time</label>
                  <Input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="h-9" />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valid recipients:</span>
              <Badge className="bg-primary/10 text-primary border-0">
                {validCount}
              </Badge>
            </div>

            <InvalidRecipientsPreview invalidRecipients={invalidRecipients} />

            <Button
              onClick={handleSend}
              disabled={sending || (!scheduleMode && validCount === 0) || !message.trim()}
              className={`w-full ${channel === "whatsapp" ? "bg-[#25D366] hover:bg-[#1da851]" : "bg-primary"}`}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : scheduleMode ? (
                <Clock className="h-4 w-4 mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sending ? "Processing..." : scheduleMode ? `Schedule ${channelLabel}` : `Send ${channelLabel} to ${validCount} recipient${validCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
