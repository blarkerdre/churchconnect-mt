import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const PRETEENS_UNIT_NAMES = ["preteens", "preteen", "preteenagers", "youth", "preteens ministry", "preteen ministry", "preteens church", "preteen church"];

/**
 * Returns { isLeader, isMember, isLoading } for the Preteens church unit.
 * - isLeader: user is in unit_leader_assignments for a Preteens unit
 * - isMember: user's member row lists a Preteens unit in church_unit, OR they are a leader
 */
export function usePreteensUnitRole() {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();

  const { data, isLoading } = useQuery({
    queryKey: ["preteens-unit-role", user?.id, tenantId],
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
        PRETEENS_UNIT_NAMES.includes(String(r.unit_name || "").trim().toLowerCase())
      );
      const memberUnits = (memberRows?.[0]?.church_unit || "")
        .split(",")
        .map((u) => u.trim().toLowerCase());
      const isMember =
        isLeader || memberUnits.some((u) => PRETEENS_UNIT_NAMES.includes(u));

      return { isLeader, isMember };
    },
  });

  return {
    isLeader: !!data?.isLeader,
    isMember: !!data?.isMember,
    isLoading,
  };
}
