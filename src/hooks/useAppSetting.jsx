import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";

/**
 * Hook to fetch a configurable list from app_settings by key.
 * Returns the array of string values, with a fallback default.
 */
export function useAppSetting(key, fallback = []) {
  const { tenantId, scopeQuery } = useTenantQuery();

  const { data, ...rest } = useQuery({
    queryKey: ["app-settings", key, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("app_settings").select("value").eq("key", key)
      ).then(res => ({ ...res, data: res.data?.[0] || null }));
      // scopeQuery returns the full result; we need maybeSingle behavior
      if (error) throw error;
      if (data?.value && Array.isArray(data.value)) return data.value;
      return fallback;
    },
  });

  return { data: data ?? fallback, ...rest };
}
