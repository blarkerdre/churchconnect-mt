import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export default function SMSHistoryDialog({ open, onOpenChange, defaultFilter = "All", channelFilter = null }) {
  const [typeFilter, setTypeFilter] = useState(defaultFilter);

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

  const sentCount = logs.filter(l => l.status === "sent").length;
  const failedCount = logs.filter(l => l.status === "failed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            SMS History
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 mt-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["All", "announcement", "event", "followup", "bulk"].map(t => (
                <SelectItem key={t} value={t}>{t === "All" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 text-xs">
            <Badge className="bg-chart-3/10 text-chart-3 border-0">{sentCount} sent</Badge>
            {failedCount > 0 && <Badge className="bg-destructive/10 text-destructive border-0">{failedCount} failed</Badge>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 mt-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No SMS logs found</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="border rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{log.recipient_phone}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs ${log.channel === "whatsapp" ? "border-[#25D366] text-[#25D366]" : ""}`}>
                      {log.channel === "whatsapp" ? "WhatsApp" : "SMS"}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{log.sms_type}</Badge>
                    <Badge className={`border-0 text-xs ${
                      log.delivery_status === "delivered" ? "bg-chart-3/10 text-chart-3" :
                      ["failed", "undelivered"].includes(log.delivery_status) ? "bg-destructive/10 text-destructive" :
                      log.status === "sent" ? "bg-primary/10 text-primary" :
                      "bg-destructive/10 text-destructive"
                    }`}>
                      {log.delivery_status || log.status}
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
                  <p className="text-xs text-destructive">{log.error_message}</p>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
