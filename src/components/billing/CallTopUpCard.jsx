import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Phone, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";
import { money as formatMoney } from "@/lib/money";

const PACKS = [60, 300, 600, 1200];
const STATUS = { paid: "Paid", pending: "Not completed", cancelled: "Cancelled" };

export default function CallTopUpCard({ tenantId, canBuy }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const confirmPw = useConfirmDelete();
  const [qty, setQty] = useState(300);
  const [loading, setLoading] = useState(false);
  const { data } = useQuery({
    queryKey: ["call-billing", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      try { await supabase.functions.invoke("verify-call-topups", { body: { tenant_id: tenantId } }); } catch { /* best effort */ }
      const { data: t } = await supabase.from("tenants").select("call_minutes_limit_monthly, call_minutes_balance, call_minute_price_override, pricing_plan_id, billing_currency").eq("id", tenantId).single();
      let plan = null;
      if (t?.pricing_plan_id) ({ data: plan } = await supabase.from("pricing_plans").select("overage_price_call_minute, currency").eq("id", t.pricing_plan_id).maybeSingle());
      const { data: used } = await supabase.rpc("call_minutes_used", { _tenant_id: tenantId });
      const { data: topups } = await supabase.from("call_minute_topups").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10);
      const currency = t?.billing_currency || "GBP";
      const unitPrice = t?.call_minute_price_override != null ? Number(t.call_minute_price_override)
        : ((plan?.currency || "GBP").toUpperCase() === currency ? Number(plan?.overage_price_call_minute || 0) : 0);
      return { t, used: Number(used || 0), topups: topups || [], currency, unitPrice };
    },
  });
  if (!data) return null;
  const lim = Number(data.t?.call_minutes_limit_monthly || 0);
  const total = data.unitPrice * Number(qty || 0);

  const buy = async () => {
    if (!(await confirmPw({ title: "Confirm call minutes payment", description: `Pay ${formatMoney(total, data.currency)} for ${Number(qty)} minutes.`, confirmLabel: "Continue to payment" }))) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("create-call-topup-checkout", { body: { tenant_id: tenantId, minutes: Number(qty) } });
      if (error) {
        let msg = error.message;
        try { msg = JSON.parse(await error.context.text()).error || msg; } catch { /* keep */ }
        throw new Error(msg);
      }
      if (res?.url) window.open(res.url, "_blank");
      qc.invalidateQueries({ queryKey: ["call-billing", tenantId] });
    } catch (e) {
      toast({ title: "Couldn't start payment", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3 text-sm">
      <p className="font-semibold flex items-center gap-2"><Phone className="h-4 w-4 text-accent" /> Phone call minutes</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div><p className="text-xs text-muted-foreground">Used this cycle</p><p className="font-medium">{data.used} of {lim > 0 ? `${lim} min` : "unlimited"}</p></div>
        <div><p className="text-xs text-muted-foreground">Extra minutes balance</p><p className="font-medium">{Number(data.t?.call_minutes_balance || 0)} min</p></div>
        <div><p className="text-xs text-muted-foreground">Price per minute</p><p className="font-medium">{data.unitPrice > 0 ? formatMoney(data.unitPrice, data.currency) : "Not set"}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">Calls are charged per started minute. When monthly minutes run out, extra minutes are used. Extra minutes carry over.</p>
      {canBuy && data.unitPrice > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Buy more minutes</Label>
          <div className="flex flex-wrap gap-2">
            {PACKS.map((p) => <Button key={p} type="button" size="sm" variant={Number(qty) === p ? "default" : "outline"} onClick={() => setQty(p)}>{p}</Button>)}
            <Input type="number" min={10} max={100000} value={qty} onChange={(e) => setQty(e.target.value)} className="w-28 h-9" aria-label="Number of minutes" />
          </div>
          <Button size="sm" onClick={buy} disabled={loading || Number(qty) < 10}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Pay by card {formatMoney(total, data.currency)}
          </Button>
        </div>
      )}
      {data.topups.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Minute top-up history</p>
          {data.topups.map((t) => (
            <div key={t.id} className="text-xs border-b border-border/50 pb-1 flex flex-wrap justify-between gap-1">
              <span>{format(new Date(t.created_at), "d MMM yyyy")} - {t.minutes} min</span>
              <span>{formatMoney(Number(t.amount), t.currency)} - {STATUS[t.status] || t.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
