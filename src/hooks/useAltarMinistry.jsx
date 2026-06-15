import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const DEFAULT_UNIT = "Altar Ministry";

/**
 * Resolves the configured Altar Ministry unit name and the current user's
 * relationship to it (member / leader). Also exposes the members + leaders list.
 */
export function useAltarMinistry() {
  const { user } = useAuth();
  const { tenantId, scopeQuery } = useTenantQuery();

  const { data: unitName = DEFAULT_UNIT } = useQuery({
    queryKey: ["altar-ministry-unit", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("tenant_id", tenantId)
        .eq("key", "pastoral.altar_ministry_unit")
        .maybeSingle();
      const v = data?.value;
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object" && typeof v.name === "string") return v.name;
      return DEFAULT_UNIT;
    },
  });

  const { data: people = [] } = useQuery({
    queryKey: ["altar-ministry-people", tenantId, unitName],
    enabled: !!tenantId && !!unitName,
    queryFn: async () => {
      const lc = unitName.toLowerCase();
      const { data: leaders = [] } = await scopeQuery(
        supabase.from("unit_leader_assignments").select("user_id, unit_name")
      );
      const leaderIds = new Set(
        (leaders || []).filter(l => (l.unit_name || "").toLowerCase() === lc).map(l => l.user_id)
      );
      const { data: members = [] } = await scopeQuery(
        supabase.from("members").select("user_id, first_name, last_name, email").not("user_id", "is", null)
          .ilike("church_unit", `%${unitName}%`)
      );
      const ids = new Set([...leaderIds, ...(members || []).map(m => m.user_id)]);
      const arr = [...ids];
      if (arr.length === 0) return [];
      const { data: profiles = [] } = await supabase
        .from("profiles").select("user_id, full_name, email").in("user_id", arr);
      return (profiles || []).map(p => ({
        user_id: p.user_id,
        name: p.full_name || p.email || "Unknown",
        email: p.email,
        is_leader: leaderIds.has(p.user_id),
      }));
    },
  });

  const isMember = !!user && people.some(p => p.user_id === user.id);
  const isLeader = !!user && people.some(p => p.user_id === user.id && p.is_leader);

  return { unitName, people, isMember, isLeader };
}
