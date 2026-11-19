import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";

const PACKS = [100, 500, 1000, 5000];

export function useSmsBilling(tenantId) {
  return useQuery({
    queryKey: ["sms-billing", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: t } = await supabase.from("tenants").select("sms_limit_monthly, sms_credit_balance, sms_unit_price_override, pricing_plan_id").eq("id", tenantId).single();
      let plan = null;
      if (t?.pricing_plan_id) {
        const { data } = await supabase.from("pricing_plans").select("overage_price_sms, currency, allow_overage_sms").eq("id", t.pricing_plan_id).maybeSingle();
        plan = data;
      }
      const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase.from("sms_log").select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("channel", "sms").neq("status", "failed").gte("created_at", start.toISOString());
      const { data: topups } = await supabase.from("sms_topups").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10);
      const override = t?.sms_unit_price_override;
      const unitPrice = override !== null && override !== undefined ? Number(override) : Number(plan?.overage_price_sms || 0);
      return { tenant: t, plan, used: count || 0, topups: topups || [], unitPrice, currency: plan?.currency || "GBP" };
    },
  });
}

const money = (n, c) => new Intl.NumberFormat("en-GB", { style: "currency", currency: c || "GBP" }).format(n);

export default function SmsTopUpCard({ tenantId, canBuy }) {
  const { toast } = useToast();
  const { data, isLoading } = useSmsBilling(tenantId);
  const [qty, setQty] = useState(500);
  const [loading, setLoading] = useState(false);
  if (isLoading || !data) return null;
  const limit = Number(data.tenant?.sms_limit_monthly || 0);

  const buy = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("create-sms-topup-checkout", { body: { tenant_id: tenantId, quantity: Number(qty) } });
      if (error) {
        let msg = error.message;
        try { msg = JSON.parse(await error.context.text()).error || msg; } catch { /* keep */ }
        throw new Error(msg);
      }
      if (res?.url) window.open(res.url, "_blank");
    } catch (e) {
      toast({ title: "Couldn't start payment", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3 text-sm">
      <p className="font-semibold flex items-center gap-2"><MessageSquare className="h-4 w-4 text-accent" /> Text messages (SMS)</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div><p className="text-xs text-muted-foreground">Texts this month</p><p className="font-medium">{data.used.toLocaleString()} of {limit > 0 ? limit.toLocaleString() : "unlimited"}</p></div>
        <div><p className="text-xs text-muted-foreground">Top-up balance</p><p className="font-medium">{Number(data.tenant?.sms_credit_balance || 0).toLocaleString()} texts</p></div>
        <div><p className="text-xs text-muted-foreground">Price per text</p><p className="font-medium">{data.unitPrice > 0 ? money(data.unitPrice, data.currency) : "Not set"}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">
        When monthly texts run out, top-up texts are used first.
        {data.plan?.allow_overage_sms ? " After that, extra texts are added to your next invoice." : " After that, sending stops until you buy more."}
        {" "}Top-up texts carry over to next month.
      </p>
      {canBuy && data.unitPrice > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Buy more texts</Label>
          <div className="flex flex-wrap gap-2">
            {PACKS.map((p) => (
              <Button key={p} type="button" size="sm" variant={Number(qty) === p ? "default" : "outline"} onClick={() => setQty(p)}>{p.toLocaleString()}</Button>
            ))}
            <Input type="number" min={10} max={100000} value={qty} onChange={(e) => setQty(e.target.value)} className="w-28 h-9" aria-label="Number of texts" />
          </div>
          <Button size="sm" onClick={buy} disabled={loading || Number(qty) < 10}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Pay {money(data.unitPrice * Number(qty || 0), data.currency)}
          </Button>
        </div>
      )}
      {data.topups.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Top-up history</p>
          {data.topups.map((t) => (
            <div key={t.id} className="flex justify-between text-xs">
              <span>{format(new Date(t.created_at), "d MMM yyyy")} - {t.quantity.toLocaleString()} texts</span>
              <span>{money(Number(t.amount), t.currency)} - {t.status === "paid" ? "Paid" : t.status === "pending" ? "Not completed" : t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
