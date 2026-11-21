import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useConfirmDelete } from "@/components/shared/DeleteConfirmProvider";
import { Landmark, Loader2, Check, X } from "lucide-react";

/** Request / track / confirm a subscription payment by bank transfer. */
export default function SubscriptionBankTransfer({ tenantId, subscription, canRequest, isSuperAdmin }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null);
  const confirmPw = useConfirmDelete();

  const { data: pending = [] } = useQuery({
    queryKey: ["sub-bank-pending", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenant_payments").select("*")
        .eq("tenant_id", tenantId).eq("status", "awaiting_transfer").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });
  const { data: bank } = useQuery({
    queryKey: ["billing-bank-details"],
    queryFn: async () => (await supabase.rpc("get_billing_bank_details")).data || "",
  });

  const refresh = () => {
    ["sub-bank-pending", "tenant-payments", "tenant-payments-admin", "church-invoices", "tenant-invoices", "tenant-subscription", "tenant-status"]
      .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
  const run = async (key, fn, ok) => {
    if (!(await confirmPw({ title: "Confirm subscription payment change", description: ok.startsWith("Invoice") ? "Create a bank transfer invoice for your subscription." : ok === "Payment confirmed" ? "Mark this subscription payment as received." : "Cancel this bank transfer request.", confirmLabel: "Continue" }))) return;
    setBusy(key);
    try {
      const { error } = await fn();
      if (error) throw error;
      toast({ title: ok });
      refresh();
    } catch (e) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  if (!subscription || subscription.stripe_subscription_id) return null;

  return (
    <div className="space-y-2">
      {pending.length === 0 && canRequest && (
        <Button variant="outline" className="w-full" disabled={busy === "req"}
          onClick={() => run("req", () => supabase.rpc("request_subscription_bank_payment", { _tenant_id: tenantId }), "Invoice created - see bank details below")}>
          {busy === "req" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Landmark className="h-4 w-4 mr-2" />} Pay subscription by bank transfer
        </Button>
      )}
      {pending.map((p) => (
        <div key={p.id} className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs space-y-1.5">
          <div className="font-medium text-sm">Awaiting bank transfer</div>
          <div>Amount: <span className="font-semibold">{p.currency} {Number(p.amount).toFixed(2)}</span>{p.includes_setup_fee ? " (includes setup fee)" : ""}</div>
          <div>Reference: <span className="font-mono font-semibold">{p.reference}</span> (please use this on your transfer)</div>
          {bank ? <pre className="whitespace-pre-wrap font-sans text-muted-foreground">{bank}</pre> : <div className="text-muted-foreground">Bank details will be provided by the administrator.</div>}
          <div className="text-muted-foreground">Your subscription is renewed once the transfer is confirmed.</div>
          <div className="flex gap-2 pt-1">
            {isSuperAdmin && (
              <Button size="sm" className="h-7 text-xs" disabled={!!busy}
                onClick={() => run(p.id + "ok", () => supabase.rpc("confirm_subscription_bank_payment", { _payment_id: p.id }), "Payment confirmed")}>
                <Check className="h-3.5 w-3.5 mr-1" /> Mark as received
              </Button>
            )}
            {(canRequest || isSuperAdmin) && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={!!busy}
                onClick={() => run(p.id + "x", () => supabase.rpc("cancel_subscription_bank_payment", { _payment_id: p.id }), "Request cancelled")}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
