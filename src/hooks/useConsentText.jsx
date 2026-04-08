import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_CONSENT_TEXT =
  "By completing this form, you agree that we will use, process and retain your personal data in accordance with our Privacy Policy. You have the right to withdraw this consent at any time.";
const DEFAULT_PRIVACY_URL =
  "https://winners-chapel.org.uk/wp-content/uploads/2024/11/WMA_PrivacyPolicy2024.pdf";

/**
 * Hook for authenticated pages — uses tenant context.
 */
export function useConsentText(tenantId) {
  const { data } = useQuery({
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

  return {
    consentText: data?.consent_text || DEFAULT_CONSENT_TEXT,
    privacyUrl: data?.privacy_policy_url || DEFAULT_PRIVACY_URL,
  };
}

/**
 * Fetch consent settings for a resolved tenant (works without auth for public pages).
 */
export function usePublicConsentText(resolvedTenantId) {
  const { data } = useQuery({
    queryKey: ["consent-settings-public", resolvedTenantId],
    enabled: !!resolvedTenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .eq("tenant_id", resolvedTenantId)
        .in("key", ["consent_text", "privacy_policy_url"]);
      if (error) throw error;
      const map = {};
      (data || []).forEach((r) => (map[r.key] = r.value));
      return map;
    },
  });

  return {
    consentText: data?.consent_text || DEFAULT_CONSENT_TEXT,
    privacyUrl: data?.privacy_policy_url || DEFAULT_PRIVACY_URL,
  };
}
