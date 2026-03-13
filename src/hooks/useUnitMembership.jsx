import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Check if the current user is a member of a specific church unit.
 * Returns { isMemberOfUnit, isLoading }
 */
export function useUnitMembership(unitName) {
  const { user } = useAuth();

  const { data: isMemberOfUnit = false, isLoading } = useQuery({
    queryKey: ["unit-membership", user?.id, unitName],
    enabled: !!user?.id && !!unitName,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("church_unit")
        .eq("user_id", user.id)
        .single();
      if (error || !data?.church_unit) return false;
      const units = data.church_unit.split(",").map(u => u.trim().toLowerCase());
      return units.includes(unitName.toLowerCase());
    },
  });

  return { isMemberOfUnit, isLoading };
}
