import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import SmsTopUpCard, { useSmsBilling } from "./SmsTopUpCard";

export default function SmsPricingAdmin({ tenantId }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useSmsBilling(tenantId);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const o = data?.tenant?.sms_unit_price_override;
    setPrice(o === null || o === undefined ? "" : String(o));
  }, [data?.tenant?.sms_unit_price_override]);

  const save = async () => {
    const v = price.trim() === "" ? null : Number(price);
    if (v !== null && (!Number.isFinite(v) || v < 0)) { toast({ title: "Enter a valid price", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await supabase.from("tenants").update({ sms_unit_price_override: v }).eq("id", tenantId);
    setSaving(false);
    if (error) toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    else { toast({ title: "SMS price saved" }); qc.invalidateQueries({ queryKey: ["sms-billing", tenantId] }); }
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">SMS pricing</h4>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Cost per SMS ({data?.currency || "GBP"})</Label>
          <Input type="number" step="0.0001" min={0} value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder={`Plan price: ${Number(data?.plan?.overage_price_sms || 0)}`} className="w-44" />
        </div>
        <Button size="sm" onClick={save} disabled={saving}>Save</Button>
      </div>
      <p className="text-xs text-muted-foreground">Leave blank to use the plan's price. Used for top-ups and extra texts after the monthly quota.</p>
      <SmsTopUpCard tenantId={tenantId} canBuy={false} />
    </div>
  );
}
