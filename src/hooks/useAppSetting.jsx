import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";

/**
 * Hook to fetch a configurable list from app_settings by key.
 * Always tenant-scoped — returns fallback until tenantId is known.
 */
export function useAppSetting(key, fallback = []) {
  const { tenantId } = useTenantQuery();

  const { data, ...rest } = useQuery({
    queryKey: ["app-settings", key, tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      if (data?.value && Array.isArray(data.value)) return data.value;
      return fallback;
    },
  });

  return { data: data ?? fallback, ...rest };
}

