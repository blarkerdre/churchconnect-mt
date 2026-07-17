import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const TEENS_UNIT_NAMES = ["teens", "teen", "teenagers", "youth", "teens ministry", "teen ministry"];

/**
 * Returns { isLeader, isMember, isLoading } for the Teens church unit.
 * - isLeader: user is in unit_leader_assignments for a Teens unit
 * - isMember: user's member row lists a Teens unit in church_unit, OR they are a leader
 */
export function useTeensUnitRole() {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();

  const { data, isLoading } = useQuery({
    queryKey: ["teens-unit-role", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const [{ data: leaderRows }, { data: memberRows }] = await Promise.all([
        supabase
          .from("unit_leader_assignments")
          .select("unit_name")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId),
        supabase
          .from("members")
          .select("church_unit")
          .eq("user_id", user.id)
          .eq("tenant_id", tenantId),
      ]);

      const isLeader = (leaderRows || []).some((r) =>
        TEENS_UNIT_NAMES.includes(String(r.unit_name || "").trim().toLowerCase())
      );
      const memberUnits = (memberRows?.[0]?.church_unit || "")
        .split(",")
        .map((u) => u.trim().toLowerCase());
      const isMember =
        isLeader || memberUnits.some((u) => TEENS_UNIT_NAMES.includes(u));

      return { isLeader, isMember };
    },
  });

  return {
    isLeader: !!data?.isLeader,
    isMember: !!data?.isMember,
    isLoading,
  };
}
