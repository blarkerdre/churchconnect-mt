import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";

const roleLabel = (role) =>
  role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Member";

/**
 * Super-admin-only lookup of every church a set of users belongs to.
 * Returns a map: { [user_id]: [{ tenant_id, name, slug, role }] }
 */
export function useUserChurches(userIds = [], enabled = true) {
  const ids = [...new Set(userIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["user-churches", ids],
    enabled: enabled && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_memberships")
        .select("user_id, role, tenant_id, tenants(id, name, slug)")
        .in("user_id", ids);
      if (error) throw error;
      const map = {};
      for (const m of data || []) {
        (map[m.user_id] ||= []).push({
          tenant_id: m.tenant_id,
          role: m.role,
          name: m.tenants?.name || "Unknown church",
          slug: m.tenants?.slug || null,
        });
      }
      for (const list of Object.values(map)) {
        list.sort((a, b) => a.name.localeCompare(b.name));
      }
      return map;
    },
  });
}

/**
 * Renders the churches a user belongs to. The currently active church is
 * highlighted. Render nothing when there is nothing to show.
 */
export default function UserChurchBadges({ churches = [], currentTenantId }) {
  if (!churches.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
      {churches.map((c) => {
        const isCurrent = c.tenant_id === currentTenantId;
        return (
          <Badge
            key={c.tenant_id}
            variant="outline"
            className={`text-[10px] ${
              isCurrent
                ? "border-primary/40 text-primary bg-primary/5"
                : "text-muted-foreground"
            }`}
            title={`${c.name} — ${roleLabel(c.role)}`}
          >
            {c.name}
            <span className="opacity-70 ml-1">· {roleLabel(c.role)}</span>
          </Badge>
        );
      })}
    </div>
  );
}
