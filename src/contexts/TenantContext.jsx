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
const DEFAULT_TENANT_ID = "d8bbbdae-d9b3-4999-912d-3aa5999884b0";

export function TenantProvider({ children }) {
  const { user, loading: authLoading, roles } = useAuth();
  const isSuperAdmin = (roles || []).includes("super_admin");
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
      // Look up pending invitations for this user's email
      const { data: invitations } = await supabase
        .from("tenant_invitations")
        .select("id")
        .eq("email", email.toLowerCase())
        .eq("status", "pending");

      if (!invitations || invitations.length === 0) return;

      // Use the secure RPC that validates and consumes each invitation atomically.
      // This replaces the previous client-side insert pattern, which was vulnerable
      // to self-assigning roles by replaying matching invitation rows.
      for (const inv of invitations) {
        const { error } = await supabase.rpc("accept_tenant_invitation", {
          _invitation_id: inv.id,
        });
        if (error) {
          console.warn("accept_tenant_invitation failed:", inv.id, error.message);
        }
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
  const isTenantAdmin = tenantRole === "admin" || tenantRole === "owner" || (isSuperAdmin && !!currentTenant);
  const isTenantOwner = tenantRole === "owner" || (isSuperAdmin && !!currentTenant);

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
