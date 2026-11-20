import { useState } from "react";
import { Link } from "react-router-dom";
import { useSmsBilling } from "@/components/billing/SmsTopUpCard";
import { smsLowState } from "@/lib/sms-low";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

export default function LowSmsBanner({ tenantId, tenantSlug }) {
  const { data } = useSmsBilling(tenantId);
  const key = `sms-low-dismiss-${tenantId}-${new Date().toISOString().slice(0, 10)}`;
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && localStorage.getItem(key) === "1");
  if (!data || hidden) return null;
  const s = smsLowState({ limit: data.tenant?.sms_limit_monthly, used: data.used, balance: data.tenant?.sms_credit_balance, threshold: data.tenant?.sms_low_threshold });
  if (!s.low) return null;
  const tone = s.empty ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-accent/15 text-foreground border-accent/40";
  return (
    <div className={`mx-3 mt-3 lg:mx-8 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${tone}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">{s.empty ? "You've run out of texts." : `Only ${s.available.toLocaleString()} texts left.`} Top up to keep sending.</span>
      <Button asChild size="sm" className="h-7"><Link to={`${tenantSlug ? `/t/${tenantSlug}` : ""}/settings?tab=billing`}>Top up</Link></Button>
      <button aria-label="Dismiss for today" className="p-1 opacity-70 hover:opacity-100" onClick={() => { localStorage.setItem(key, "1"); setHidden(true); }}><X className="h-4 w-4" /></button>
    </div>
  );
}
