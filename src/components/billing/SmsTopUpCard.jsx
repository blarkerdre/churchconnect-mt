import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { MessageSquare, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { smsCycleStart } from "@/lib/sms-cycle";

const PACKS = [100, 500, 1000, 5000];

export function useSmsBilling(tenantId) {
  return useQuery({
    queryKey: ["sms-billing", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      try { await supabase.functions.invoke("verify-sms-topups", { body: { tenant_id: tenantId } }); } catch { /* best effort */ }
      const { data: t } = await supabase.from("tenants").select("sms_limit_monthly, sms_cycle_start, sms_credit_balance, sms_low_threshold, sms_unit_price_override, pricing_plan_id, billing_currency").eq("id", tenantId).single();
      let plan = null;
      if (t?.pricing_plan_id) {
        const { data } = await supabase.from("pricing_plans").select("overage_price_sms, currency, allow_overage_sms").eq("id", t.pricing_plan_id).maybeSingle();
        plan = data;
      }
      const start = smsCycleStart(t?.sms_cycle_start);
      const { count } = await supabase.from("sms_log").select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("channel", "sms").neq("status", "failed").gte("created_at", start.toISOString());
      const { data: bank } = await supabase.rpc("get_billing_bank_details");
      const { data: topups } = await supabase.from("sms_topups").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10);
      const override = t?.sms_unit_price_override;
      const currency = t?.billing_currency || "GBP";
      const planMatches = (plan?.currency || "GBP").toUpperCase() === currency;
      const unitPrice = override !== null && override !== undefined ? Number(override) : (planMatches ? Number(plan?.overage_price_sms || 0) : 0);
      return { tenant: t, cycleStart: start, plan, used: count || 0, topups: topups || [], bank: bank || "", unitPrice, currency, planMatches };
    },
  });
}

const money = (n, c) => new Intl.NumberFormat("en-GB", { style: "currency", currency: c || "GBP" }).format(n);

const STATUS = { paid: "Paid", pending: "Not completed", awaiting_transfer: "Awaiting bank transfer", cancelled: "Cancelled" };

export default function SmsTopUpCard({ tenantId, canBuy, isSuperAdmin = false }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useSmsBilling(tenantId);
  const [busy, setBusy] = useState(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["sms-billing", tenantId] });
  const rpc = async (key, name, args, ok) => {
    setBusy(key);
    const { error } = await supabase.rpc(name, args);
    setBusy(null);
    if (error) { toast({ title: "Couldn't complete", description: error.message, variant: "destructive" }); return; }
    toast({ title: ok }); refresh();
  };
  const requestBank = () => rpc("bank", "request_sms_bank_topup", { _tenant_id: tenantId, _quantity: Number(qty) }, "Bank transfer request created - use the reference shown below");
  const [qty, setQty] = useState(500);
  const [loading, setLoading] = useState(false);
  const [thr, setThr] = useState(null);
  const [thrState, setThrState] = useState("idle");
  const saveThr = async () => {
    setThrState("saving");
    const { error } = await supabase.from("tenants").update({ sms_low_threshold: Math.max(0, Math.floor(Number(thr) || 0)) }).eq("id", tenantId);
    if (error) { setThrState("idle"); toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    setThrState("saved"); refresh(); setTimeout(() => setThrState("idle"), 3000);
  };
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
        <div><p className="text-xs text-muted-foreground">Texts since {format(data.cycleStart, "d MMM")}</p><p className="font-medium">{data.used.toLocaleString()} of {limit > 0 ? limit.toLocaleString() : "unlimited"}</p></div>
        <div><p className="text-xs text-muted-foreground">Top-up balance</p><p className="font-medium">{Number(data.tenant?.sms_credit_balance || 0).toLocaleString()} texts</p></div>
        <div><p className="text-xs text-muted-foreground">Price per text</p><p className="font-medium">{data.unitPrice > 0 ? money(data.unitPrice, data.currency) : "Not set"}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">
        When monthly texts run out, top-up texts are used first.
        {data.plan?.allow_overage_sms ? " After that, extra texts are added to your next invoice." : " After that, sending stops until you buy more."}
        {" "}Monthly texts restart each time your subscription payment is confirmed. Top-up texts carry over.
      </p>
      {canBuy && limit > 0 && (() => {
        const current = Number(data.tenant?.sms_low_threshold ?? 20);
        const val = thr ?? current;
        const dirty = Number(val) !== current;
        return (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">Warn me when texts left fall to</Label>
              <Input type="number" min={0} value={val} onChange={(e) => { setThr(e.target.value); setThrState("idle"); }} className="w-28 h-9" />
            </div>
            <Button size="sm" variant={dirty ? "default" : "secondary"} disabled={!dirty || thrState === "saving"} onClick={saveThr}>
              {thrState === "saving" ? "Saving..." : thrState === "saved" ? "Saved ✓" : "Save"}
            </Button>
            <p className="text-xs text-muted-foreground w-full">Admins see a top-up reminder and get a notification at this level. Set 0 to turn off.</p>
          </div>
        );
      })()}
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
            Pay by card {money(data.unitPrice * Number(qty || 0), data.currency)}
          </Button>
          <Button size="sm" variant="outline" onClick={requestBank} disabled={busy === "bank" || Number(qty) < 10} className="ml-2">
            {busy === "bank" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Pay by bank transfer
          </Button>
          <p className="text-xs text-muted-foreground">Bank transfer texts are added once the payment is confirmed as received.</p>
        </div>
      )}
      {data.topups.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Top-up history</p>
          {data.topups.map((t) => (
            <div key={t.id} className="text-xs border-b border-border/50 pb-1 space-y-1">
              <div className="flex flex-wrap justify-between gap-1">
                <span>{format(new Date(t.created_at), "d MMM yyyy")} - {t.quantity.toLocaleString()} texts{t.method === "bank_transfer" ? " (bank transfer)" : ""}</span>
                <span>{money(Number(t.amount), t.currency)} - {STATUS[t.status] || t.status}</span>
              </div>
              {t.status === "awaiting_transfer" && (
                <div className="bg-background rounded p-2 space-y-1">
                  <p>Pay <strong>{money(Number(t.amount), t.currency)}</strong> using reference <strong className="font-mono">{t.reference}</strong></p>
                  {data.bank ? <p className="whitespace-pre-line text-muted-foreground">{data.bank}</p> : <p className="text-muted-foreground">Bank details will be sent by your administrator.</p>}
                  <div className="flex gap-2">
                    {isSuperAdmin && <Button size="sm" className="h-7" disabled={!!busy} onClick={() => rpc(t.id, "confirm_sms_bank_topup", { _topup_id: t.id }, "Payment confirmed - texts added")}>{busy === t.id ? "Confirming..." : "Mark as received"}</Button>}
                    {(canBuy || isSuperAdmin) && <Button size="sm" variant="ghost" className="h-7" disabled={!!busy} onClick={() => rpc("c" + t.id, "cancel_sms_bank_topup", { _topup_id: t.id }, "Request cancelled")}>Cancel</Button>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
