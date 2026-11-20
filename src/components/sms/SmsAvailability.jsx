import { useParams, Link } from "react-router-dom";
import { useSmsBilling } from "@/components/billing/SmsTopUpCard";
import { smsSendCoverage } from "@/lib/sms-coverage";
import { smsSegments } from "@/lib/sms-segments";

export function useSmsSendCheck(tenantId, text, recipients) {
  const { data } = useSmsBilling(tenantId);
  if (!data) return { ready: false, blocked: false };
  const segments = Math.max(1, smsSegments(text || "").segments || 1);
  const cov = smsSendCoverage({
    limit: Number(data.tenant?.sms_limit_monthly || 0), used: data.used,
    credits: Number(data.tenant?.sms_credit_balance || 0), allowOverage: Boolean(data.plan?.allow_overage_sms),
    recipients, segments,
  });
  return { ready: true, ...cov, unitPrice: data.unitPrice, currency: data.currency };
}

const n = (x) => Number(x).toLocaleString();

export default function SmsAvailability({ check }) {
  const { tenantSlug } = useParams();
  if (!check?.ready) return null;
  const billing = tenantSlug ? `/t/${tenantSlug}/settings` : "/settings";
  if (check.unlimited) return <p className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">No monthly text limit. This send needs {n(check.needed)} texts.</p>;
  const tone = check.blocked ? "bg-destructive/10 text-destructive" : (check.fromCredits || check.overage) ? "bg-accent/20 text-accent-foreground" : "bg-primary/10 text-primary";
  const left = check.available - check.needed;
  return (
    <div className={`space-y-0.5 rounded px-2 py-1.5 text-xs ${tone}`}>
      <p className="font-medium">Texts available: {n(check.available)} ({n(check.freeLeft)} left this month + {n(check.credits)} top-up)</p>
      <p>This send needs {n(check.needed)} texts.</p>
      {check.blocked ? (
        <p>Not enough. You are short by {n(check.short)} texts. <Link to={billing} className="underline font-medium">Buy more texts</Link></p>
      ) : check.overage > 0 ? (
        <p>{n(check.overage)} extra texts will be charged{check.unitPrice ? ` at ${check.unitPrice} ${check.currency} each` : ""}.</p>
      ) : (
        <p>Enough{check.fromCredits ? `, uses ${n(check.fromCredits)} top-up texts` : ""}. {n(Math.max(0, left))} texts will be left after sending.</p>
      )}
    </div>
  );
}
