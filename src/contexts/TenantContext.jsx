import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate } from "react-router-dom";

const TenantContext = createContext({
  currentTenant: null,
  tenantId: null,
  tenantSlug: null,
  tenantMemberships: [],
  tenantRole: null,
  isTenantAdmin: false,
  isTenantOwner: false,
  loading: true,
  switchTenant: () => {},
});

/**
 * Default tenant ID used during the migration period.
 * All existing data has been backfilled to this tenant.
 */
const DEFAULT_TENANT_ID = "95e53cc3-4569-4dd3-a4ad-3489593dce81";

export function TenantProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [currentTenant, setCurrentTenant] = useState(null);
  const [tenantMemberships, setTenantMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const tenantSlugFromUrl = params.tenantSlug;

  const fetchMemberships = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from("tenant_memberships")
        .select("*, tenants(*)")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching tenant memberships:", error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error("Error fetching tenant memberships:", err);
      return [];
    }
  }, []);

  const selectTenant = useCallback((memberships, slugHint) => {
    if (!memberships || memberships.length === 0) return null;

    // If a slug is specified in URL, use that tenant
    if (slugHint) {
      const match = memberships.find(m => m.tenants?.slug === slugHint);
      if (match) return match;
    }

    // Single tenant → auto-select
    if (memberships.length === 1) return memberships[0];

    // Multiple tenants, no slug → pick the default or first
    const defaultMatch = memberships.find(m => m.tenant_id === DEFAULT_TENANT_ID);
    return defaultMatch || memberships[0];
  }, []);

  const acceptPendingInvitations = useCallback(async (userId, email) => {
    if (!email) return;
    try {
      const { data: invitations } = await supabase
        .from("tenant_invitations")
        .select("id, tenant_id, role")
        .eq("email", email.toLowerCase())
        .eq("status", "pending");

      if (!invitations || invitations.length === 0) return;

      for (const inv of invitations) {
        // Check if already a member
        const { data: existing } = await supabase
          .from("tenant_memberships")
          .select("id")
          .eq("tenant_id", inv.tenant_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (!existing) {
          await supabase.from("tenant_memberships").insert({
            tenant_id: inv.tenant_id,
            user_id: userId,
            role: inv.role || "member",
          });

          // Also create user_roles entry for tenant access
          await supabase.from("user_roles").insert({
            user_id: userId,
            role: "member",
            tenant_id: inv.tenant_id,
          });
        }

        await supabase
          .from("tenant_invitations")
          .update({ status: "accepted" })
          .eq("id", inv.id);
      }
    } catch (err) {
      console.error("Error accepting pending invitations:", err);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setCurrentTenant(null);
      setTenantMemberships([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // Auto-accept any pending invitations first
      await acceptPendingInvitations(user.id, user.email);

      const memberships = await fetchMemberships(user.id);
      if (cancelled) return;

      setTenantMemberships(memberships);
      const selected = selectTenant(memberships, tenantSlugFromUrl);
      setCurrentTenant(selected);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, tenantSlugFromUrl, fetchMemberships, selectTenant, acceptPendingInvitations]);

  const switchTenant = useCallback((tenantId) => {
    const match = tenantMemberships.find(m => m.tenant_id === tenantId);
    if (match) setCurrentTenant(match);
  }, [tenantMemberships]);

  const refreshTenantContext = useCallback(async () => {
    if (!user) return;
    const memberships = await fetchMemberships(user.id);
    setTenantMemberships(memberships);
    const selected = selectTenant(memberships, tenantSlugFromUrl);
    setCurrentTenant(selected);
  }, [user, fetchMemberships, selectTenant, tenantSlugFromUrl]);

  const tenantId = currentTenant?.tenant_id || null;
  const tenantSlug = currentTenant?.tenants?.slug || null;
  const tenantRole = currentTenant?.role || null;
  const isTenantAdmin = tenantRole === "admin" || tenantRole === "owner";
  const isTenantOwner = tenantRole === "owner";

  return (
    <TenantContext.Provider
      value={{
        currentTenant: currentTenant?.tenants || null,
        tenantId,
        tenantSlug,
        tenantMemberships,
        tenantRole,
        isTenantAdmin,
        isTenantOwner,
        loading,
        switchTenant,
        refreshTenantContext,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);

export { DEFAULT_TENANT_ID };
