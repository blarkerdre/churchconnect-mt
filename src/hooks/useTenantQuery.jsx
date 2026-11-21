import { useTenant } from "@/contexts/TenantContext";
import { useCallback, useMemo } from "react";

/**
 * Hook that provides the current tenant_id for use in queries.
 * 
 * Usage:
 *   const { tenantId, withTenant } = useTenantQuery();
 * 
 *   // Use tenantId in .eq() filters:
 *   supabase.from("members").select("*").eq("tenant_id", tenantId)
 * 
 *   // Use withTenant to auto-inject tenant_id into insert payloads:
 *   supabase.from("members").insert(withTenant({ first_name: "John", last_name: "Doe" }))
 */
export const NO_TENANT = "00000000-0000-0000-0000-000000000000";

export function useTenantQuery() {
  const { tenantId } = useTenant();

  /**
   * Injects tenant_id into an insert/update payload object.
   * If tenantId is null (during migration), it still works - the column is nullable.
   */
  const withTenant = useCallback(
    (payload) => {
      if (Array.isArray(payload)) {
        return payload.map((item) => ({ ...item, tenant_id: tenantId }));
      }
      return { ...payload, tenant_id: tenantId };
    },
    [tenantId]
  );

  /**
   * Adds .eq("tenant_id", tenantId) to a Supabase query builder if tenantId is set.
   * For backward compatibility, if tenantId is null, returns the query unchanged.
   */
  const scopeQuery = useCallback(
    (query) => {
      // Fail closed: with no church selected, match nothing rather than every church.
      return query.eq("tenant_id", tenantId || NO_TENANT);
    },
    [tenantId]
  );

  return useMemo(
    () => ({ tenantId, withTenant, scopeQuery }),
    [tenantId, withTenant, scopeQuery]
  );
}
