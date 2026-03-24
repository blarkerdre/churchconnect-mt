import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";

export function useChurchUnits(activeOnly = true) {
  const { tenantId, scopeQuery } = useTenantQuery();

  return useQuery({
    queryKey: ["church-units", activeOnly, tenantId],
    queryFn: async () => {
      let q = supabase.from("church_units").select("*").order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await scopeQuery(q);
      if (error) throw error;
      return data;
    },
  });
}
