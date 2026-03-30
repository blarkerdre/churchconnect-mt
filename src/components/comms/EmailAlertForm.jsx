import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Send, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import AudienceFilter from "./AudienceFilter";

export default function EmailAlertForm({ currentUser, myUnits = [], isAdmin }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [filters, setFilters] = useState({ status: "all", unit: "all", dateFrom: null, dateTo: null });
  const [sending, setSending] = useState(false);
  const { tenantId } = useTenantQuery();

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
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
        audience: "All Members", // backward compat fallback
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

        <AudienceFilter filters={filters} onChange={setFilters} />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Subject</label>
          <Input placeholder="Email subject..." value={subject} onChange={e => setSubject(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Message</label>
          <Textarea placeholder="Write your message here..." value={body} onChange={e => setBody(e.target.value)} rows={6} className="resize-none" />
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
          <span>Emails will be sent from <strong>noreply@notify.churchmanagementsuite.org</strong> and queued for reliable delivery.</span>
        </div>

        <Button
          onClick={handleSend}
          disabled={!subject.trim() || !body.trim() || sending}
          className="w-full sm:w-auto"
        >
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          {sending ? "Sending..." : "Send Email Alert"}
        </Button>
      </Card>
    </div>
  );
}
