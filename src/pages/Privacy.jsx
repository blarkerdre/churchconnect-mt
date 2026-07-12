import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useConsentText } from "@/hooks/useConsentText";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Privacy() {
  const { tenantId, currentTenant, tenantSlug } = useTenant();
  const { privacyUrl } = useConsentText(tenantId);
  const churchName = currentTenant?.name || "the Church";

  const { data: dpo } = useQuery({
    queryKey: ["dpo-contact", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings")
        .select("value").eq("tenant_id", tenantId).eq("key", "dpo_contact").maybeSingle();
      return data?.value || null;
    },
  });

  const { data: policies = [] } = useQuery({
    queryKey: ["retention-summary", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.from("retention_policies")
        .select("data_category, retention_days, description")
        .eq("tenant_id", tenantId).eq("enabled", true);
      return data || [];
    },
  });

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to={tenantSlug ? `/t/${tenantSlug}` : "/"}><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" /> Privacy Notice
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          How {churchName} handles your personal data under UK GDPR & the Data Protection Act 2018.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Who is the data controller?</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><strong>{churchName}</strong> is the controller responsible for your personal data. The app that hosts this data acts as a processor on the church's behalf.</p>
          {dpo && <p>Contact for privacy queries: <a href={`mailto:${dpo}`} className="underline text-primary">{dpo}</a></p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>What we collect & why</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Identity & contact</strong> — name, email, phone, address. To identify you and communicate.</li>
            <li><strong>Church-life data</strong> — attendance, follow-ups, ministry involvement, training progress. For pastoral care and reporting.</li>
            <li><strong>Special-category data</strong> — religious affiliation (implied by membership), pastoral prayer notes, health considerations you volunteer for pastoral support. Processed only with your consent or for legitimate church activities under Article 9(2)(d).</li>
            <li><strong>Children's data</strong> — if you are a guardian, we hold basic details of your children for check-in and safeguarding. Parental consent is required.</li>
            <li><strong>Technical data</strong> — sign-in logs, IP address hashes for abuse prevention.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lawful bases</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>We rely on:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Consent</strong> (Art. 6(1)(a)) — marketing, photos, third-party sharing.</li>
            <li><strong>Legitimate interests</strong> (Art. 6(1)(f)) — pastoral care of members, attendance records.</li>
            <li><strong>Legal obligation</strong> (Art. 6(1)(c)) — safeguarding of children, statutory reports.</li>
            <li><strong>Article 9(2)(d)</strong> — legitimate activities of a not-for-profit religious body, limited to members and regular contacts.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Retention</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>We keep data only for as long as needed:</p>
          <ul className="list-disc pl-5 space-y-1">
            {policies.map((p) => (
              <li key={p.data_category}>
                <strong>{p.data_category.replace(/_/g, " ")}</strong> — {Math.round(p.retention_days / 30)} months
                {p.description && ` (${p.description.toLowerCase()})`}
              </li>
            ))}
            {policies.length === 0 && <li>Default retention: as long as you remain a member, plus 6 years.</li>}
          </ul>
          <p className="text-xs text-muted-foreground">Retention is enforced automatically each day.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recipients & sub-processors</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>We share data only with vetted processors under written contracts:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Cloud hosting & database (UK / EEA region)</li>
            <li>Email delivery (transactional & pastoral notifications)</li>
            <li>SMS / voice provider (attendance & follow-up messages)</li>
            <li>Payment processor for tenant subscriptions (does not receive member data)</li>
          </ul>
          <p className="text-xs text-muted-foreground">Ask the DPO contact above for the current sub-processor register.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Your rights</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access a copy of your data (Article 15)</li>
            <li>Correct inaccurate data (Article 16)</li>
            <li>Request erasure (Article 17)</li>
            <li>Restrict or object to processing (Articles 18 & 21)</li>
            <li>Withdraw consent at any time</li>
            <li>Complain to the ICO (<a className="underline text-primary" href="https://ico.org.uk" target="_blank" rel="noreferrer">ico.org.uk</a>)</li>
          </ul>
          <Button asChild className="mt-2">
            <Link to={tenantSlug ? `/t/${tenantSlug}/my-data` : "/my-data"}>Exercise my rights</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cookies & storage</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>We use strictly-necessary storage for authentication and church selection. Optional functional storage remembers your onboarding progress. No third-party analytics are active.</p>
          <Button variant="outline" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-preferences"))}>
            Manage cookie preferences
          </Button>
        </CardContent>
      </Card>

      {privacyUrl && (
        <p className="text-xs text-muted-foreground text-center">
          Full corporate policy: <a href={privacyUrl} target="_blank" rel="noreferrer" className="underline text-primary">{privacyUrl}</a>
        </p>
      )}
    </div>
  );
}
