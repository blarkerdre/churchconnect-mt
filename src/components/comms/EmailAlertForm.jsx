import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Mail, Loader2, CheckCircle2, Clock, CalendarIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import AudienceFilter from "./AudienceFilter";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export default function EmailAlertForm({ currentUser, myUnits = [], isAdmin, restrictedUnits }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const initialUnit = restrictedUnits && restrictedUnits.length === 1 ? restrictedUnits[0] : "all";
  const [filters, setFilters] = useState({ status: "all", unit: initialUnit, dateFrom: null, dateTo: null });
  const [sending, setSending] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(null);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const { tenantId, withTenant } = useTenantQuery();
  const { user } = useAuth();

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;

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
          channel: "email",
          filters: {
            status: filters.status !== "all" ? filters.status : null,
            unit: filters.unit !== "all" ? filters.unit : null,
            dateFrom: filters.dateFrom ? filters.dateFrom.toISOString() : null,
            dateTo: filters.dateTo ? new Date(filters.dateTo.getFullYear(), filters.dateTo.getMonth(), filters.dateTo.getDate(), 23, 59, 59, 999).toISOString() : null,
          },
          subject: subject.trim(),
          message: body.trim(),
          scheduled_at: scheduledAt.toISOString(),
          created_by: user?.id,
        }));

        if (error) throw error;
        toast({ title: "Email scheduled", description: `Will be sent on ${format(scheduledAt, "dd MMM yyyy 'at' HH:mm")}` });
        setSubject("");
        setBody("");
        setScheduleDate(null);
        setScheduleMode(false);
      } catch (err) {
        toast({ title: "Failed to schedule", description: err.message, variant: "destructive" });
      } finally {
        setSending(false);
      }
      return;
    }

    setSending(true);
    try {
      const payload = {
        subject: subject.trim(),
        body: body.trim(),
        tenant_id: tenantId,
        filters: {
          status: filters.status !== "all" ? filters.status : null,
          unit: filters.unit !== "all" ? filters.unit : null,
          dateFrom: filters.dateFrom ? filters.dateFrom.toISOString() : null,
          dateTo: filters.dateTo ? new Date(filters.dateTo.getFullYear(), filters.dateTo.getMonth(), filters.dateTo.getDate(), 23, 59, 59, 999).toISOString() : null,
        },
        audience: "All Members",
      };

      const { data, error } = await supabase.functions.invoke("send-email-alert", { body: payload });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Email Alert", description: data.error, variant: data.sent === 0 ? "default" : "destructive" });
      } else {
        toast({
          title: "Emails queued successfully",
          description: `${data.sent} email(s) queued for delivery${data.skipped ? ` (${data.skipped} suppressed)` : ""}.`,
        });
        setSubject("");
        setBody("");
      }
    } catch (err) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="border-0 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-sm">Compose Email Alert</p>
            <p className="text-xs text-muted-foreground">Send an email notification directly to members</p>
          </div>
        </div>

        <AudienceFilter filters={filters} onChange={setFilters} restrictedUnits={restrictedUnits} />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Subject</label>
          <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Message</label>
          <Textarea placeholder="Write your message here..." value={body} onChange={e => setBody(e.target.value)} rows={6} className="resize-none" />
        </div>

        {/* Schedule toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground flex-1">Schedule for later</label>
          <Switch checked={scheduleMode} onCheckedChange={setScheduleMode} />
        </div>

        {scheduleMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
          <span>Emails will be sent from <strong>noreply@notify.churchmanagementsuite.org</strong> and queued for reliable delivery.</span>
        </div>

        <Button
          onClick={handleSend}
          disabled={!subject.trim() || !body.trim() || sending}
          className="w-full sm:w-auto"
        >
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : scheduleMode ? <Clock className="h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          {sending ? "Processing..." : scheduleMode ? "Schedule Email" : "Send Email Alert"}
        </Button>
      </Card>
    </div>
  );
}
