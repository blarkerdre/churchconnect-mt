import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { csvSafeCell } from "@/lib/csv-safe";
import { money } from "@/lib/money";
import { ArrowLeft, Download, Phone } from "lucide-react";
import { format } from "date-fns";

const FAILED = new Set(["failed", "busy", "no-answer", "canceled", "cancelled", "error"]);

export default function CallUsageReport() {
  const { tenantSlug } = useParams();
  const prefix = tenantSlug ? `/t/${tenantSlug}` : "";
  const { tenantId } = useTenantQuery();

  const { data } = useQuery({
    queryKey: ["call-usage-report", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: t } = await supabase.from("tenants")
        .select("call_minutes_limit_monthly, call_minutes_balance, call_minute_price_override, billing_currency")
        .eq("id", tenantId).single();
      const { data: used } = await supabase.rpc("call_minutes_used", { _tenant_id: tenantId });
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      const { data: rows } = await supabase.from("call_log")
        .select("status, delivery_status, duration_seconds, billable_minutes, created_at")
        .eq("tenant_id", tenantId).gte("created_at", start.toISOString()).limit(50000);
      const { data: topups } = await supabase.from("call_minute_topups")
        .select("id, minutes, amount, currency, status, created_at")
        .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10);
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yyyy"), calls: 0, connected: 0, failed: 0, minutes: 0, seconds: 0 });
      }
      const byKey = Object.fromEntries(months.map(m => [m.key, m]));
      for (const r of rows || []) {
        const m = byKey[String(r.created_at).slice(0, 7)];
        if (!m) continue;
        m.calls++;
        const st = String(r.delivery_status || r.status || "").toLowerCase();
        if (FAILED.has(st)) m.failed++;
        else if ((r.duration_seconds || 0) > 0) m.connected++;
        m.minutes += r.billable_minutes || 0;
        m.seconds += r.duration_seconds || 0;
      }
      return { t, used: Number(used || 0), months, topups: topups || [] };
    },
  });

  const t = data?.t;
  const limit = t?.call_minutes_limit_monthly || 0;
  const used = data?.used || 0;
  const freeLeft = Math.max(0, limit - used);
  const balance = t?.call_minutes_balance || 0;
  const cur = t?.billing_currency || "GBP";
  const curMonth = data?.months?.[5];
  const avg = curMonth?.connected ? Math.round(curMonth.seconds / curMonth.connected) : 0;

  const downloadCsv = () => {
    const head = ["Month", "Calls", "Connected", "Failed", "Billable minutes"];
    const lines = [head.map(csvSafeCell).join(",")].concat(
      (data?.months || []).map(m => [m.label, m.calls, m.connected, m.failed, m.minutes].map(csvSafeCell).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `call-usage-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  const stats = [
    ["Minutes used this cycle", limit ? `${used}/${limit}` : `${used} (unlimited)`],
    ["Free minutes left", limit ? freeLeft : "Unlimited"],
    ["Extra minutes balance", balance],
    ["Minutes available now", limit ? freeLeft + balance : "Unlimited"],
    ["Calls this month", curMonth?.calls ?? "…"],
    ["Average call length", avg ? `${Math.floor(avg / 60)}m ${avg % 60}s` : "—"],
    ["Price per extra minute", t?.call_minute_price_override != null ? money(t.call_minute_price_override, cur) : "Plan price"],
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to={`${prefix}/reports`}><ArrowLeft className="h-4 w-4 mr-1" />Reports Hub</Link></Button>
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary"><Phone className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-display font-bold">Call Usage</h1>
          <p className="text-sm text-muted-foreground">Minute allowance, extra minutes, and call history.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map(([l, v]) => (
          <Card key={l}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold">{v}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Last 6 months</CardTitle>
          <Button size="sm" variant="outline" onClick={downloadCsv} disabled={!data}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Month</th><th>Calls</th><th>Connected</th><th>Failed</th><th>Minutes</th></tr></thead>
            <tbody>{(data?.months || []).map(m => (
              <tr key={m.key} className="border-t"><td className="py-1">{m.label}</td><td>{m.calls}</td><td>{m.connected}</td><td>{m.failed}</td><td>{m.minutes}</td></tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent minute top-ups</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(data?.topups || []).length === 0 && <p className="text-muted-foreground text-xs">No top-ups yet.</p>}
          {(data?.topups || []).map(x => (
            <div key={x.id} className="flex flex-wrap justify-between gap-2 border-t py-1">
              <span>{format(new Date(x.created_at), "d MMM yyyy")}</span>
              <span>{x.minutes} minutes</span>
              <span>{x.amount != null ? money(x.amount, x.currency || cur) : ""}</span>
              <span className="text-muted-foreground capitalize">{x.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
