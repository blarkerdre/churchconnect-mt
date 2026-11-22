import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callLowState } from "@/lib/call-low";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

export default function LowCallBanner({ tenantId, tenantSlug }) {
  const { data } = useQuery({
    queryKey: ["call-low", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data: t } = await supabase.from("tenants").select("call_minutes_limit_monthly, call_minutes_balance, call_low_alert_settings").eq("id", tenantId).single();
      if (!t || Number(t.call_minutes_limit_monthly || 0) <= 0) return { t };
      const { data: used } = await supabase.rpc("call_minutes_used", { _tenant_id: tenantId });
      return { t, used: Number(used || 0) };
    },
  });
  const key = `call-low-dismiss-${tenantId}-${new Date().toISOString().slice(0, 10)}`;
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && localStorage.getItem(key) === "1");
  if (!data?.t || hidden) return null;
  const s = callLowState({ limit: data.t.call_minutes_limit_monthly, used: data.used, balance: data.t.call_minutes_balance, settings: data.t.call_low_alert_settings });
  if (!s.low) return null;
  const tone = s.empty ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-accent/15 text-foreground border-accent/40";
  return (
    <div className={`mx-3 mt-3 lg:mx-8 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${tone}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">{s.empty ? "You've run out of call minutes." : `Only ${s.available.toLocaleString()} call minutes left.`} Top up to keep calling.</span>
      <Button asChild size="sm" className="h-7"><Link to={`${tenantSlug ? `/t/${tenantSlug}` : ""}/settings?tab=billing`}>Top up</Link></Button>
      <button aria-label="Dismiss for today" className="p-1 opacity-70 hover:opacity-100" onClick={() => { localStorage.setItem(key, "1"); setHidden(true); }}><X className="h-4 w-4" /></button>
    </div>
  );
}
