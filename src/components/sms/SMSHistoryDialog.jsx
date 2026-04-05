import React, { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TenantDialogHeader from "@/components/ui/TenantDialogHeader";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageSquare, AlertTriangle, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const DELIVERY_STATUS_CONFIG = {
  delivered: { label: "Delivered", className: "bg-chart-3/10 text-chart-3" },
  sent: { label: "Sent", className: "bg-primary/10 text-primary" },
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  sending: { label: "Sending", className: "bg-primary/10 text-primary" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
  undelivered: { label: "Undelivered", className: "bg-destructive/10 text-destructive" },
};

function getStatusDisplay(log) {
  const ds = log.delivery_status || log.status;
  const config = DELIVERY_STATUS_CONFIG[ds] || DELIVERY_STATUS_CONFIG[log.status];
  return config || { label: ds || "Unknown", className: "bg-muted text-muted-foreground" };
}

function getTrialAccountHint(errorMessage) {
  if (!errorMessage) return null;
  const lower = errorMessage.toLowerCase();
  if (lower.includes("unverified") || lower.includes("trial") || lower.includes("21608") || lower.includes("21211") || lower.includes("21614")) {
    return "This may be due to a Twilio trial account restriction. Verify the recipient number in your Twilio console or upgrade to a paid account.";
  }
  if (lower.includes("21612") || lower.includes("not a valid sms-capable")) {
    return "The sender phone number may not be SMS-capable. Check your TWILIO_FROM_NUMBER configuration.";
  }
  return null;
}

export default function SMSHistoryDialog({ open, onOpenChange, defaultFilter = "All", channelFilter = null }) {
  const [typeFilter, setTypeFilter] = useState(defaultFilter);
  const [selectedLog, setSelectedLog] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["sms-logs", typeFilter, channelFilter],
    queryFn: async () => {
      let query = supabase
        .from("sms_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (typeFilter !== "All") {
        query = query.eq("sms_type", typeFilter);
      }
      if (channelFilter) {
        query = query.eq("channel", channelFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const sentCount = logs.filter(l => l.status === "sent" || l.status === "delivered").length;
  const failedCount = logs.filter(l => l.status === "failed").length;
  const queuedCount = logs.filter(l => l.delivery_status === "queued" && l.status === "sent").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <TenantDialogHeader>
            <MessageSquare className="h-5 w-5 text-primary" />
            SMS History
          </TenantDialogHeader>

        <div className="flex items-center justify-between gap-3 mt-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All", "announcement", "event", "followup", "bulk"].map(t => (
                <SelectItem key={t} value={t}>{t === "All" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 text-xs flex-wrap">
            <Badge className="bg-chart-3/10 text-chart-3 border-0">{sentCount} sent</Badge>
            {queuedCount > 0 && <Badge className="bg-muted text-muted-foreground border-0">{queuedCount} queued</Badge>}
            {failedCount > 0 && <Badge className="bg-destructive/10 text-destructive border-0">{failedCount} failed</Badge>}
          </div>
        </div>

        {queuedCount > 3 && (
          <Alert className="mt-2">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Multiple messages are stuck in "queued" status. If using a Twilio trial account, ensure recipient numbers are verified in your Twilio console.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 mt-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No SMS logs found</p>
          ) : (
            logs.map(log => {
              const statusDisplay = getStatusDisplay(log);
              const trialHint = getTrialAccountHint(log.error_message);
              return (
                <div key={log.id} className="border rounded-lg p-3 text-sm space-y-1 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedLog(log)}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{log.recipient_phone}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${log.channel === "whatsapp" ? "border-[#25D366] text-[#25D366]" : ""}`}>
                        {log.channel === "whatsapp" ? "WhatsApp" : "SMS"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{log.sms_type}</Badge>
                      <Badge className={`border-0 text-xs ${statusDisplay.className}`}>
                        {statusDisplay.label}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-muted-foreground truncate">{log.message}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd MMM yyyy, h:mm a")}
                    </p>
                    {log.delivery_updated_at && (
                      <p className="text-xs text-muted-foreground">
                        Updated: {format(new Date(log.delivery_updated_at), "h:mm a")}
                      </p>
                    )}
                  </div>
                  {log.error_message && (
                    <p className="text-xs text-destructive truncate">{log.error_message}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>

      {/* SMS Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(v) => !v && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <TenantDialogHeader>
              <MessageSquare className="h-5 w-5 text-primary" />
              Message Detail
            </TenantDialogHeader>
        <DialogDescription>Full message and delivery details</DialogDescription>
          {selectedLog && (() => {
            const sd = getStatusDisplay(selectedLog);
            const hint = getTrialAccountHint(selectedLog.error_message);
            return (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={`${selectedLog.channel === "whatsapp" ? "border-[#25D366] text-[#25D366]" : ""}`}>
                    {selectedLog.channel === "whatsapp" ? "WhatsApp" : "SMS"}
                  </Badge>
                  <Badge variant="outline">{selectedLog.sms_type}</Badge>
                  <Badge className={`border-0 ${sd.className}`}>{sd.label}</Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Recipient</p>
                  <p className="text-sm font-medium text-foreground">{selectedLog.recipient_phone}</p>
                </div>

                <Separator />

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Message</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{selectedLog.message}</p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Sent</p>
                    <p className="font-medium text-foreground">{format(new Date(selectedLog.created_at), "dd MMM yyyy, h:mm a")}</p>
                  </div>
                  {selectedLog.delivery_updated_at && (
                    <div>
                      <p className="text-muted-foreground">Last Updated</p>
                      <p className="font-medium text-foreground">{format(new Date(selectedLog.delivery_updated_at), "dd MMM yyyy, h:mm a")}</p>
                    </div>
                  )}
                </div>

                {selectedLog.message_sid && (
                  <div className="text-xs">
                    <p className="text-muted-foreground">Message SID</p>
                    <p className="font-mono text-foreground break-all">{selectedLog.message_sid}</p>
                  </div>
                )}

                {selectedLog.error_message && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-destructive">Error</p>
                    <p className="text-sm text-destructive whitespace-pre-wrap">{selectedLog.error_message}</p>
                  </div>
                )}

                {hint && (
                  <div className="flex items-start gap-1.5 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">{hint}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
