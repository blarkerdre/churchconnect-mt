import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { renewalState } from "@/lib/renewal-reminder";
import { Button } from "@/components/ui/button";
import { CalendarClock, X } from "lucide-react";
import { format } from "date-fns";

export function useRenewalInfo(tenantId) {
  return useQuery({
    queryKey: ["renewal-info", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const [{ data: t }, { data: s }] = await Promise.all([
        supabase.from("tenants").select("renewal_reminder_days").eq("id", tenantId).single(),
        supabase.from("tenant_subscriptions").select("next_due_date, amount, currency, payment_mode, stripe_subscription_id")
          .eq("tenant_id", tenantId).eq("is_active", true).order("next_due_date", { ascending: true }).limit(1).maybeSingle(),
      ]);
      return { reminderDays: t?.renewal_reminder_days ?? 7, sub: s };
    },
  });
}

export default function RenewalBanner({ tenantId, tenantSlug }) {
  const { data } = useRenewalInfo(tenantId);
  const key = `renewal-dismiss-${tenantId}-${new Date().toISOString().slice(0, 10)}`;
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && localStorage.getItem(key) === "1");
  if (!data?.sub || hidden) return null;
  const s = renewalState({ dueDate: data.sub.next_due_date, reminderDays: data.reminderDays });
  if (!s.show) return null;
  const due = format(new Date(data.sub.next_due_date), "d MMM yyyy");
  const amt = data.sub.amount ? new Intl.NumberFormat("en-GB", { style: "currency", currency: data.sub.currency || "GBP" }).format(Number(data.sub.amount)) : "";
  const auto = !!data.sub.stripe_subscription_id && data.sub.payment_mode !== "manual";
  const text = auto && !s.overdue ? `Your card will be charged ${amt} on ${due}.`
    : s.overdue ? `Subscription payment overdue by ${-s.daysLeft} day${s.daysLeft === -1 ? "" : "s"} (${due})${amt ? ` – ${amt}` : ""}.`
    : s.dueToday ? `Subscription payment due today${amt ? ` – ${amt}` : ""}.`
    : `Your subscription renews in ${s.daysLeft} day${s.daysLeft === 1 ? "" : "s"} (${due})${amt ? ` – ${amt}` : ""}.`;
  const tone = s.overdue ? "bg-destructive/10 text-destructive border-destructive/30" : auto ? "bg-muted text-foreground border-border" : "bg-accent/15 text-foreground border-accent/40";
  return (
    <div className={`mx-3 mt-3 lg:mx-8 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm ${tone}`}>
      <CalendarClock className="h-4 w-4 shrink-0" />
      <span className="flex-1 min-w-0">{text}</span>
      {!(auto && !s.overdue) && <Button asChild size="sm" className="h-7"><Link to={`${tenantSlug ? `/t/${tenantSlug}` : ""}/settings?tab=billing`}>Renew / Pay</Link></Button>}
      <button aria-label="Dismiss for today" className="p-1 opacity-70 hover:opacity-100" onClick={() => { localStorage.setItem(key, "1"); setHidden(true); }}><X className="h-4 w-4" /></button>
    </div>
  );
}

export function RenewalReminderSetting({ tenantId }) {
  const { data, refetch } = useRenewalInfo(tenantId);
  const [val, setVal] = useState(null);
  const [state, setState] = useState("idle");
  if (!data) return null;
  const v = val ?? data.reminderDays;
  const dirty = Number(v) !== Number(data.reminderDays);
  const save = async () => {
    setState("saving");
    const n = Math.min(90, Math.max(0, Math.floor(Number(v) || 0)));
    const { error } = await supabase.from("tenants").update({ renewal_reminder_days: n }).eq("id", tenantId);
    if (error) { setState("error"); return; }
    setState("saved"); setVal(null); refetch(); setTimeout(() => setState("idle"), 3000);
  };
  return (
    <div className="p-4 bg-muted/50 rounded-lg text-sm flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs font-medium block mb-1">Remind me this many days before renewal</label>
        <input type="number" min={0} max={90} value={v} onChange={(e) => { setVal(e.target.value); setState("idle"); }} className="w-28 h-9 rounded-md border border-input bg-background px-2" />
      </div>
      <Button size="sm" variant={dirty ? "default" : "secondary"} disabled={!dirty || state === "saving"} onClick={save}>
        {state === "saving" ? "Saving..." : state === "saved" ? "Saved ✓" : "Save"}
      </Button>
      {state === "error" && <p className="text-xs text-destructive w-full">Couldn't save. Please try again.</p>}
      <p className="text-xs text-muted-foreground w-full">Admins see a reminder and get a notification from this many days before payment is due. Set 0 to turn off.</p>
    </div>
  );
}
