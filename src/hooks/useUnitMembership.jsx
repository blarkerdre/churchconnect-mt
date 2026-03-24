import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";

/**
 * Check if the current user is a member of a specific church unit.
 * Returns { isMemberOfUnit, isLoading }
 */
export function useUnitMembership(unitName) {
  const { user } = useAuth();
  const { tenantId, scopeQuery } = useTenantQuery();

  const { data: isMemberOfUnit = false, isLoading } = useQuery({
    queryKey: ["unit-membership", user?.id, unitName, tenantId],
    enabled: !!user?.id && !!unitName,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("members").select("church_unit").eq("user_id", user.id)
      );
      if (error || !data?.[0]?.church_unit) return false;
      const units = data[0].church_unit.split(",").map(u => u.trim().toLowerCase());
      return units.includes(unitName.toLowerCase());
    },
  });

  return { isMemberOfUnit, isLoading };
}
