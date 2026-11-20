import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

function range(p) {
  const now = new Date();
  if (p === "7d") return [new Date(now.getTime() - 7 * 864e5), now];
  const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (p === "last" ? 1 : 0), 1));
  const e = p === "last" ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : now;
  return [s, e];
}

export default function MessageSummaryPanel({ tenantId }) {
  const [period, setPeriod] = useState("month");
  const { data, isLoading } = useQuery({
    queryKey: ["msg-summary", tenantId, period],
    enabled: !!tenantId,
    queryFn: async () => {
      const [s, e] = range(period);
      const { data: rows, error } = await supabase.from("sms_log")
        .select("id, channel, status, delivery_status, error_message, created_at, recipient_phone")
        .eq("tenant_id", tenantId).gte("created_at", s.toISOString()).lt("created_at", e.toISOString())
        .order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      const { data: ledger } = await supabase.from("sms_credit_ledger").select("*").eq("tenant_id", tenantId)
        .gte("created_at", s.toISOString()).lt("created_at", e.toISOString());
      const creditsUsed = (ledger || []).reduce((a, r) => { const v = Number(r.delta ?? r.change ?? r.quantity ?? 0); return v < 0 ? a - v : a; }, 0);
      return { rows: rows || [], creditsUsed };
    },
  });
  const rows = data?.rows || [];
  const sms = rows.filter(r => (r.channel || "sms") === "sms");
  const failed = sms.filter(r => r.status === "failed").length;
  const delivered = sms.filter(r => r.status === "delivered" || r.delivery_status === "delivered").length;
  const whatsapp = rows.filter(r => r.channel === "whatsapp" && r.status !== "failed").length;
  const sent = sms.length - failed;
  const cards = [
    ["Texts sent", sent], ["Delivered", delivered], ["Failed", failed], ["WhatsApp sent", whatsapp],
    ["From top-up", data?.creditsUsed || 0], ["From free allowance", Math.max(0, sent - (data?.creditsUsed || 0))],
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-lg">Sent messages</h3>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">This month</SelectItem>
            <SelectItem value="last">Last month</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map(([l, v]) => (
          <Card key={l}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold">{isLoading ? "…" : Number(v).toLocaleString()}</p></CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-0">
        <div className="divide-y">
          {rows.slice(0, 30).map(r => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
              <span className="text-muted-foreground">{format(new Date(r.created_at), "d MMM HH:mm")}</span>
              <span>{r.channel === "whatsapp" ? "WhatsApp" : "SMS"} to {r.recipient_phone || "-"}</span>
              <span className={r.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                {r.status === "failed" ? `Failed${r.error_message ? `: ${String(r.error_message).slice(0, 80)}` : ""}` : (r.delivery_status || r.status)}
              </span>
            </div>
          ))}
          {!isLoading && rows.length === 0 && <p className="p-3 text-xs text-muted-foreground">No messages sent in this period.</p>}
        </div>
      </CardContent></Card>
    </div>
  );
}
