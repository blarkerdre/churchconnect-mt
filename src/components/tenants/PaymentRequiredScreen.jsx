import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AlertTriangle, Loader2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

export default function PaymentRequiredScreen() {
  const [loading, setLoading] = useState(false);
  const { signOut } = useAuth();
  const { tenantId, currentTenant } = useTenant();
  const { toast } = useToast();

  const { data: subscription } = useQuery({
    queryKey: ["tenant-subscription", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_subscriptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const handlePayNow = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-tenant-checkout", {
        body: { tenant_id: tenantId },
      });
      if (error) throw new Error(error.message || "Payment failed");
      if (!data?.url) throw new Error("Missing checkout URL");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({ title: "Payment Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto p-4 rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Subscription Payment Required</CardTitle>
          <CardDescription>
            Your subscription for <strong>{currentTenant?.name || "your church"}</strong> has been suspended due to non-payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription && (
            <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Due</span>
                <span className="font-semibold">
                  {subscription.currency} {Number(subscription.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billing Cycle</span>
                <Badge variant="outline" className="capitalize">{subscription.billing_cycle}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="text-destructive font-medium">{subscription.next_due_date}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handlePayNow}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            {loading ? "Redirecting to payment..." : "Pay Now"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            You will be redirected to Stripe for secure payment processing.
          </p>

          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full text-muted-foreground"
            size="sm"
          >
            <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
