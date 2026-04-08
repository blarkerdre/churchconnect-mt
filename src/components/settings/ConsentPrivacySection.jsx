import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

const DEFAULT_CONSENT_TEXT =
  "By completing this form, you agree that we will use, process and retain your personal data in accordance with our Privacy Policy. You have the right to withdraw this consent at any time.";
const DEFAULT_PRIVACY_URL =
  "https://winners-chapel.org.uk/wp-content/uploads/2024/11/WMA_PrivacyPolicy2024.pdf";

export default function ConsentPrivacySection() {
  const qc = useQueryClient();
  const { tenantId, withTenant } = useTenantQuery();
  const [consentText, setConsentText] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["consent-settings", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("tenant_id", tenantId)
        .in("key", ["consent_text", "privacy_policy_url"]);
      if (error) throw error;
      const map = {};
      (data || []).forEach((r) => (map[r.key] = r.value));
      return map;
    },
  });

  useEffect(() => {
    if (data) {
      setConsentText(data.consent_text || "");
      setPrivacyUrl(data.privacy_policy_url || "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upsert = async (key, value) => {
        const { error } = await supabase
          .from("app_settings")
          .upsert(withTenant({ key, value }), { onConflict: "key,tenant_id" });
        if (error) throw error;
      };
      await upsert("consent_text", consentText || null);
      await upsert("privacy_policy_url", privacyUrl || null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consent-settings"] });
      toast({ title: "Consent settings saved" });
    },
    onError: (e) => toast({ title: "Failed to save", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" /> Consent & Privacy
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Customize the data consent statement shown on registration forms and profile pages
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Consent Text</Label>
          <Textarea
            value={consentText}
            onChange={(e) => setConsentText(e.target.value)}
            placeholder={DEFAULT_CONSENT_TEXT}
            rows={4}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use the default. The text "Privacy Policy" will be automatically linked.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Privacy Policy URL (Optional)</Label>
          <Input
            type="url"
            value={privacyUrl}
            onChange={(e) => setPrivacyUrl(e.target.value)}
            placeholder={DEFAULT_PRIVACY_URL}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to show "Privacy Policy" as plain text (no link).
          </p>
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Consent Settings
        </Button>
      </CardContent>
    </Card>
  );
}
