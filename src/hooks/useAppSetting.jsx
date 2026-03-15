import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to fetch a configurable list from app_settings by key.
 * Returns the array of string values, with a fallback default.
 */
export function useAppSetting(key, fallback = []) {
  const { data, ...rest } = useQuery({
    queryKey: ["app-settings", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      if (data?.value && Array.isArray(data.value)) return data.value;
      return fallback;
    },
  });

  return { data: data ?? fallback, ...rest };
}
