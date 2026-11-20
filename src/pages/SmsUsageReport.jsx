import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useSmsBilling } from "@/components/billing/SmsTopUpCard";
import MessageSummaryPanel from "@/components/comms/MessageSummaryPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { csvSafeCell } from "@/lib/csv-safe";
import { ArrowLeft, Download, MessageSquare } from "lucide-react";
import { format } from "date-fns";

const money = (n, c) => new Intl.NumberFormat("en-GB", { style: "currency", currency: c || "GBP" }).format(Number(n || 0));
const STATUS = { paid: "Paid", pending: "Not completed", awaiting_transfer: "Awaiting bank transfer", cancelled: "Cancelled" };

export default function SmsUsageReport() {
  const { tenantSlug } = useParams();
  const prefix = tenantSlug ? `/t/${tenantSlug}` : "";
  const { tenantId } = useTenantQuery();
  const { data: billing } = useSmsBilling(tenantId);

  const { data: extra } = useQuery({
    queryKey: ["sms-usage-report", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: t } = await supabase.from("tenants").select("whatsapp_limit_monthly").eq("id", tenantId).single();
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
      const { data: rows } = await supabase.from("sms_log").select("channel, status, delivery_status, created_at")
        .eq("tenant_id", tenantId).gte("created_at", start.toISOString()).limit(50000);
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yyyy"), sent: 0, delivered: 0, failed: 0, whatsapp: 0 });
      }
      const byKey = Object.fromEntries(months.map(m => [m.key, m]));
      for (const r of rows || []) {
        const m = byKey[String(r.created_at).slice(0, 7)];
        if (!m) continue;
        if (r.channel === "whatsapp") { if (r.status !== "failed") m.whatsapp++; continue; }
        if (r.status === "failed") m.failed++; else m.sent++;
        if (r.status === "delivered" || r.delivery_status === "delivered") m.delivered++;
      }
      const cur = months[months.length - 1];
      return { waLimit: t?.whatsapp_limit_monthly || 0, months, waUsed: cur.whatsapp };
    },
  });

  const limit = billing?.tenant?.sms_limit_monthly || 0;
  const used = billing?.used || 0;
  const freeLeft = Math.max(0, limit - used);
  const balance = billing?.tenant?.sms_credit_balance || 0;
  const cur = billing?.currency || "GBP";

  const downloadCsv = () => {
    const head = ["Month", "Texts sent", "Delivered", "Failed", "WhatsApp sent"];
    const lines = [head.map(csvSafeCell).join(",")].concat(
      (extra?.months || []).map(m => [m.label, m.sent, m.delivered, m.failed, m.whatsapp].map(csvSafeCell).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `sms-usage-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  const stats = [
    ["Texts used this month", limit ? `${used}/${limit}` : used],
    ["WhatsApp this month", extra?.waLimit ? `${extra.waUsed}/${extra.waLimit}` : (extra?.waUsed ?? "…")],
    ["Free texts left", freeLeft],
    ["Top-up balance", balance],
    ["Texts available now", freeLeft + balance],
    ["Cost per text", billing ? money(billing.unitPrice, cur) : "…"],
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to={`${prefix}/reports`}><ArrowLeft className="h-4 w-4 mr-1" />Reports Hub</Link></Button>
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary"><MessageSquare className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-display font-bold">SMS Usage</h1>
          <p className="text-sm text-muted-foreground">Allowance, top-up balance, pricing and sent messages.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stats.map(([l, v]) => (
          <Card key={l}><CardContent className="p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-semibold">{v}</p></CardContent></Card>
        ))}
      </div>

      <MessageSummaryPanel tenantId={tenantId} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Last 6 months</CardTitle>
          <Button size="sm" variant="outline" onClick={downloadCsv} disabled={!extra}><Download className="h-4 w-4 mr-1" />CSV</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted-foreground"><th className="py-1">Month</th><th>Sent</th><th>Delivered</th><th>Failed</th><th>WhatsApp</th></tr></thead>
            <tbody>{(extra?.months || []).map(m => (
              <tr key={m.key} className="border-t"><td className="py-1">{m.label}</td><td>{m.sent}</td><td>{m.delivered}</td><td>{m.failed}</td><td>{m.whatsapp}</td></tr>
            ))}</tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Recent top-ups</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(billing?.topups || []).length === 0 && <p className="text-muted-foreground text-xs">No top-ups yet.</p>}
          {(billing?.topups || []).map(t => (
            <div key={t.id} className="flex flex-wrap justify-between gap-2 border-t py-1">
              <span>{format(new Date(t.created_at), "d MMM yyyy")}</span>
              <span>{t.credits ?? t.quantity ?? ""} texts</span>
              <span>{t.amount != null ? money(t.amount, t.currency || cur) : ""}</span>
              <span className="text-muted-foreground">{t.method === "bank_transfer" ? "Bank transfer" : "Card"} · {STATUS[t.status] || t.status}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
