import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { CreditCard, Plus, Save, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

export default function TenantBillingTab({ tenant }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", payment_date: new Date().toISOString().split("T")[0], payment_method: "Manual", reference: "", notes: "" });

  const tenantId = tenant?.id;

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["tenant-subscription-admin", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["tenant-payments-admin", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_payments")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("payment_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const [subForm, setSubForm] = useState(null);

  const upsertSubMutation = useMutation({
    mutationFn: async (payload) => {
      if (subscription) {
        const { error } = await supabase.from("tenant_subscriptions").update(payload).eq("id", subscription.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenant_subscriptions").insert({ tenant_id: tenantId, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Subscription updated" });
      queryClient.invalidateQueries({ queryKey: ["tenant-subscription-admin", tenantId] });
      setSubForm(null);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (payload) => {
      const { error } = await supabase.from("tenant_payments").insert({
        tenant_id: tenantId,
        subscription_id: subscription?.id || null,
        ...payload,
        status: "completed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      queryClient.invalidateQueries({ queryKey: ["tenant-payments-admin", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenant-subscription-admin", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["tenants-admin"] });
      setShowPaymentForm(false);
      setPaymentForm({ amount: "", payment_date: new Date().toISOString().split("T")[0], payment_method: "Manual", reference: "", notes: "" });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const statusOverrideMutation = useMutation({
    mutationFn: async (status) => {
      const { error } = await supabase.from("tenants").update({ subscription_status: status }).eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Status overridden" });
      queryClient.invalidateQueries({ queryKey: ["tenants-admin"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const initSubForm = () => {
    setSubForm({
      billing_cycle: subscription?.billing_cycle || "monthly",
      amount: subscription?.amount || "",
      currency: subscription?.currency || "GBP",
      next_due_date: subscription?.next_due_date || new Date().toISOString().split("T")[0],
      grace_period_days: subscription?.grace_period_days || 7,
      setup_fee_amount: subscription?.setup_fee_amount || 0,
    });
  };

  if (!tenantId) return <p className="text-sm text-muted-foreground">Select a tenant first</p>;

  return (
    <div className="space-y-4">
      {/* Subscription Config */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Subscription</h4>
          {!subForm && (
            <Button size="sm" variant="outline" onClick={initSubForm}>
              {subscription ? <><Save className="h-3 w-3 mr-1" /> Edit</> : <><Plus className="h-3 w-3 mr-1" /> Setup</>}
            </Button>
          )}
        </div>

        {subLoading && <p className="text-xs text-muted-foreground">Loading...</p>}

        {subscription && !subForm && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Cycle</span><Badge variant="outline" className="capitalize">{subscription.billing_cycle}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium">{subscription.currency} {Number(subscription.amount).toFixed(2)}</span></div>
            {Number(subscription.setup_fee_amount) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Setup Fee (one-time)</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{subscription.currency} {Number(subscription.setup_fee_amount).toFixed(2)}</span>
                  <Badge variant={subscription.setup_fee_paid ? "default" : "secondary"} className="text-[10px]">
                    {subscription.setup_fee_paid ? "Paid" : "Unpaid"}
                  </Badge>
                </span>
              </div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Next Due</span><span>{subscription.next_due_date}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Grace Period</span><span>{subscription.grace_period_days} days</span></div>
          {subscription.stripe_customer_id && (
              <div className="flex justify-between"><span className="text-muted-foreground">Stripe Customer</span><code className="text-xs">{subscription.stripe_customer_id}</code></div>
            )}
            {subscription.stripe_subscription_id && (
              <div className="flex justify-between"><span className="text-muted-foreground">Stripe Subscription</span><code className="text-xs">{subscription.stripe_subscription_id}</code></div>
            )}
            {subscription.stripe_subscription_id && (
              <div className="flex justify-between"><span className="text-muted-foreground">Auto-Renewing</span><Badge variant="default" className="text-[10px]">Active</Badge></div>
            )}
          </div>
        )}

        {!subscription && !subForm && !subLoading && (
          <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">No subscription configured. Click "Setup" to add one.</p>
        )}

        {subForm && (
          <div className="space-y-3 p-3 border rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Billing Cycle</Label>
                <Select value={subForm.billing_cycle} onValueChange={(v) => setSubForm({ ...subForm, billing_cycle: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Currency</Label>
                <Select value={subForm.currency} onValueChange={(v) => setSubForm({ ...subForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input type="number" step="0.01" min="0" value={subForm.amount} onChange={(e) => setSubForm({ ...subForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grace Period (days)</Label>
                <Input type="number" min="0" value={subForm.grace_period_days} onChange={(e) => setSubForm({ ...subForm, grace_period_days: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Next Due Date</Label>
              <Input type="date" value={subForm.next_due_date} onChange={(e) => setSubForm({ ...subForm, next_due_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Setup Fee (one-time, charged with first payment)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={subForm.setup_fee_amount}
                onChange={(e) => setSubForm({ ...subForm, setup_fee_amount: e.target.value })}
                placeholder="0.00"
              />
              {subscription?.setup_fee_paid && (
                <p className="text-[10px] text-muted-foreground">
                  Setup fee already paid on {subscription.setup_fee_paid_at ? format(new Date(subscription.setup_fee_paid_at), "PP") : "an earlier date"}. Changing this will not re-charge.
                </p>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setSubForm(null)}>Cancel</Button>
              <Button size="sm" disabled={!subForm.amount || upsertSubMutation.isPending} onClick={() => upsertSubMutation.mutate({ ...subForm, setup_fee_amount: Number(subForm.setup_fee_amount) || 0 })}>
                {upsertSubMutation.isPending ? "Saving..." : "Save Subscription"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Status Override */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Subscription Status Override</h4>
        <div className="flex items-center gap-2">
          <Badge variant={tenant?.subscription_status === "active" ? "default" : tenant?.subscription_status === "past_due" ? "secondary" : "destructive"} className="capitalize">
            {tenant?.subscription_status || "active"}
          </Badge>
          <div className="flex gap-1 ml-auto">
            {["active", "past_due", "suspended"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={tenant?.subscription_status === s ? "default" : "outline"}
                className="text-xs capitalize"
                disabled={statusOverrideMutation.isPending}
                onClick={() => statusOverrideMutation.mutate(s)}
              >
                {s.replace("_", " ")}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Payment History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Payment History</h4>
          <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(!showPaymentForm)}>
            <Plus className="h-3 w-3 mr-1" /> Record Payment
          </Button>
        </div>

        {showPaymentForm && (
          <div className="space-y-3 p-3 border rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <Select value={paymentForm.payment_method} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manual">Manual</SelectItem>
                    <SelectItem value="Stripe">Stripe</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reference</Label>
                <Input value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowPaymentForm(false)}>Cancel</Button>
              <Button size="sm" disabled={!paymentForm.amount || recordPaymentMutation.isPending} onClick={() => recordPaymentMutation.mutate(paymentForm)}>
                {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        )}

        {paymentsLoading ? (
          <p className="text-xs text-muted-foreground">Loading payments...</p>
        ) : payments.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3 bg-muted/50 rounded-lg">No payments recorded yet.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Amount</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{p.payment_date}</TableCell>
                    <TableCell className="text-xs font-medium">{p.currency} {Number(p.amount).toFixed(2)}</TableCell>
                    <TableCell className="text-xs">{p.payment_method || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "completed" ? "default" : "secondary"} className="text-[10px] capitalize">{p.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
