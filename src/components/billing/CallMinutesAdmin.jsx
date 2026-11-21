import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { Phone } from "lucide-react";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";

export default function CallMinutesAdmin({ tenantId }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const confirmPw = useConfirmDelete();
  const key = ["call-minutes-admin", tenantId];
  const { data } = useQuery({
    queryKey: key,
    enabled: !!tenantId,
    queryFn: async () => {
      const [{ data: t, error }, { data: used }] = await Promise.all([
        supabase.from("tenants").select("call_minutes_limit_monthly, call_minutes_balance, call_minute_price_override, billing_currency").eq("id", tenantId).maybeSingle(),
        supabase.rpc("call_minutes_used", { _tenant_id: tenantId }),
      ]);
      if (error) throw error;
      return { ...t, used: Number(used || 0) };
    },
  });
  const [limit, setLimit] = useState("");
  const [price, setPrice] = useState("");
  const [adjust, setAdjust] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!data) return;
    setLimit(String(data.call_minutes_limit_monthly ?? 0));
    setPrice(data.call_minute_price_override == null ? "" : String(Number(data.call_minute_price_override)));
  }, [data]);

  const update = async (patch, title) => {
    if (!(await confirmPw({ title: "Confirm billing change", description: "Change this church's call minutes.", confirmLabel: "Save" }))) return;
    setSaving(true);
    const { data: rows, error } = await supabase.from("tenants").update(patch).eq("id", tenantId).select("id");
    setSaving(false);
    const msg = error?.message || (!rows?.length ? "You don't have permission to change this church." : null);
    if (msg) { toast({ title: "Couldn't save", description: msg, variant: "destructive" }); return; }
    await qc.invalidateQueries({ queryKey: key });
    toast({ title });
  };

  const saveLimitPrice = () => {
    const l = Number(limit);
    const p = price.trim() === "" ? null : Number(price);
    if (!Number.isInteger(l) || l < 0) return toast({ title: "Enter a whole number of minutes (0 = unlimited)", variant: "destructive" });
    if (p !== null && (!Number.isFinite(p) || p < 0)) return toast({ title: "Enter a valid price", variant: "destructive" });
    update({ call_minutes_limit_monthly: l, call_minute_price_override: p }, "Call minutes saved");
  };
  const applyAdjust = () => {
    const a = Number(adjust);
    if (!Number.isInteger(a) || a === 0) return toast({ title: "Enter a whole number like 60 or -30", variant: "destructive" });
    const next = Math.max(0, Number(data?.call_minutes_balance || 0) + a);
    update({ call_minutes_balance: next }, a > 0 ? `Added ${a} minutes` : `Removed ${-a} minutes`).then(() => setAdjust(""));
  };

  const lim = Number(data?.call_minutes_limit_monthly || 0);
  const used = data?.used || 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Phone className="h-4 w-4" /> Call minutes</CardTitle>
        <CardDescription>Calls are charged per started minute. Minutes over the monthly allowance come off the extra minutes balance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Used this cycle</span>
            <span className="font-medium">{used} / {lim > 0 ? `${lim} min` : "unlimited"}</span>
          </div>
          {lim > 0 && <Progress value={Math.min(100, (used / lim) * 100)} />}
          <p className="text-sm text-muted-foreground">Extra minutes balance: <span className="font-medium text-foreground">{data?.call_minutes_balance ?? 0} min</span></p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Monthly allowance (minutes, 0 = unlimited)</Label><Input type="number" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} /></div>
          <div><Label>Price per minute ({data?.billing_currency || "GBP"}, blank = plan price)</Label><Input type="number" step="0.0001" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        </div>
        <Button size="sm" onClick={saveLimitPrice} disabled={saving}>Save allowance & price</Button>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]"><Label>Add or remove extra minutes</Label><Input type="number" placeholder="e.g. 60 or -30" value={adjust} onChange={(e) => setAdjust(e.target.value)} /></div>
          <Button size="sm" variant="outline" onClick={applyAdjust} disabled={saving}>Apply</Button>
        </div>
      </CardContent>
    </Card>
  );
}
