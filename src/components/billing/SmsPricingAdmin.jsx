import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SmsTopUpCard, { useSmsBilling } from "./SmsTopUpCard";

const CURRENCIES = ["GBP", "USD", "EUR", "NGN", "CAD"];

export default function SmsPricingAdmin({ tenantId }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useSmsBilling(tenantId);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(null); // "price" | "currency" | null
  const [saved, setSaved] = useState(null);
  const [err, setErr] = useState({});
  const [cur, setCur] = useState("GBP");
  useEffect(() => { if (data?.currency) setCur(data.currency); }, [data?.currency]);
  const flash = (k) => { setSaved(k); setTimeout(() => setSaved((v) => (v === k ? null : v)), 3000); };
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["sms-billing", tenantId] }),
    qc.invalidateQueries({ queryKey: ["tenant-subscription-admin", tenantId] }),
  ]);
  const saveCurrency = async () => {
    const { data: sub } = await supabase.from("tenant_subscriptions").select("id, stripe_subscription_id").eq("tenant_id", tenantId).maybeSingle();
    if (sub?.stripe_subscription_id && !window.confirm("This church has an active card subscription. Stripe can't change its currency, so the subscription will need to be set up again in the new currency. Continue?")) return;
    setSaving("currency"); setErr((e) => ({ ...e, currency: null }));
    const { data: rows, error } = await supabase.from("tenants").update({ billing_currency: cur }).eq("id", tenantId).select("id");
    const msg = error?.message || (!rows?.length ? "You don't have permission to change this church." : null);
    if (!msg && sub) await supabase.from("tenant_subscriptions").update({ currency: cur }).eq("id", sub.id).eq("tenant_id", tenantId);
    if (msg) { setSaving(null); setErr((e) => ({ ...e, currency: msg })); toast({ title: "Couldn't save", description: msg, variant: "destructive" }); return; }
    await refresh(); setSaving(null); flash("currency"); toast({ title: "Billing currency saved" });
  };
  const savedOverride = data?.tenant?.sms_unit_price_override;
  const savedStr = savedOverride === null || savedOverride === undefined ? "" : String(Number(savedOverride));
  useEffect(() => { setPrice(savedStr); }, [savedStr]);
  const dirty = price.trim() !== savedStr && !(price.trim() !== "" && Number(price) === Number(savedStr) && savedStr !== "");

  const save = async () => {
    const v = price.trim() === "" ? null : Number(price);
    if (v !== null && (!Number.isFinite(v) || v < 0)) { setErr((e) => ({ ...e, price: "Enter a valid price." })); return; }
    setSaving("price"); setErr((e) => ({ ...e, price: null }));
    const { data: rows, error } = await supabase.from("tenants").update({ sms_unit_price_override: v }).eq("id", tenantId).select("id");
    const msg = error?.message || (!rows?.length ? "You don't have permission to change this church." : null);
    if (msg) { setSaving(null); setErr((e) => ({ ...e, price: msg })); toast({ title: "Couldn't save", description: msg, variant: "destructive" }); return; }
    await refresh(); setSaving(null); flash("price"); toast({ title: "SMS price saved" });
  };
  const fmt = (n) => new Intl.NumberFormat("en-GB", { style: "currency", currency: data?.currency || "GBP", maximumFractionDigits: 4 }).format(n);
  const btnLabel = (k) => (saving === k ? "Saving..." : saved === k ? "Saved \u2713" : "Save");

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Billing currency</h4>
      <div className="flex flex-wrap items-end gap-2">
        <Select value={cur} onValueChange={setCur}>
          <SelectTrigger className="w-44" aria-label="Billing currency"><SelectValue /></SelectTrigger>
          <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={saveCurrency} disabled={!!saving || (cur === data?.currency && saved !== "currency")}>{btnLabel("currency")}</Button>
        {err.currency && <p className="text-xs text-destructive">{err.currency}</p>}
      </div>
      <p className="text-xs text-muted-foreground">Used for the subscription, SMS top-ups and extra texts. Past payments keep their original currency.</p>
      <h4 className="text-sm font-medium">SMS pricing</h4>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Cost per SMS ({data?.currency || "GBP"})</Label>
          <Input type="number" step="0.0001" min={0} value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder={data?.planMatches ? `Plan price: ${Number(data?.plan?.overage_price_sms || 0)}` : "Required"} className="w-44" />
        </div>
        <Button size="sm" onClick={save} disabled={!!saving || (!dirty && saved !== "price")}>{btnLabel("price")}</Button>
        {err.price && <p className="text-xs text-destructive">{err.price}</p>}
      </div>
      <p className="text-xs font-medium">
        Current price: {data?.unitPrice > 0 ? `${fmt(data.unitPrice)} per text (${savedStr !== "" ? "church price" : "plan price"})` : "Not set"}
      </p>
      <div className="hidden">
      </div>
      {data && !data.planMatches && (data.tenant?.sms_unit_price_override == null
        ? <p className="text-xs text-destructive">The plan is priced in {data.plan?.currency || "GBP"}. Set a Cost per SMS in {data.currency} so this church can buy texts.</p>
        : <p className="text-xs text-muted-foreground">Using this church's own price in {data.currency} (the plan's {data.plan?.currency || "GBP"} price is ignored).</p>)}
      <p className="text-xs text-muted-foreground">Leave blank to use the plan's price. Used for top-ups and extra texts after the monthly quota.</p>
      <SmsTopUpCard tenantId={tenantId} canBuy={false} />
    </div>
  );
}
