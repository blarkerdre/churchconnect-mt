import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useParams, useNavigate, useLocation } from "react-router-dom";

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
  tenantBasePath: "",
});

/**
 * Default tenant ID used during the migration period.
 * All existing data has been backfilled to this tenant.
 */
const DEFAULT_TENANT_ID = "a0000000-0000-0000-0000-000000000001";

export function TenantProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [currentTenant, setCurrentTenant] = useState(null);
  const [tenantMemberships, setTenantMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
      const memberships = await fetchMemberships(user.id);
      if (cancelled) return;

      setTenantMemberships(memberships);
      const selected = selectTenant(memberships, tenantSlugFromUrl);
      setCurrentTenant(selected);
      setLoading(false);

      // Canonical redirect: if no tenant slug in URL but we resolved one, redirect
      if (selected && !tenantSlugFromUrl) {
        const slug = selected.tenants?.slug;
        if (slug) {
          // Get the current path (could be "/", "/members", etc.)
          const currentPath = location.pathname === "/" ? "" : location.pathname;
          navigate(`/t/${slug}${currentPath}`, { replace: true });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user, authLoading, tenantSlugFromUrl, fetchMemberships, selectTenant]);

  const switchTenant = useCallback((tenantId) => {
    const match = tenantMemberships.find(m => m.tenant_id === tenantId);
    if (match) {
      setCurrentTenant(match);
      const slug = match.tenants?.slug;
      if (slug) {
        // Preserve current page path when switching tenants
        const currentPagePath = location.pathname.replace(/^\/t\/[^/]+/, "") || "/";
        navigate(`/t/${slug}${currentPagePath === "/" ? "" : currentPagePath}`);
      }
    }
  }, [tenantMemberships, navigate, location.pathname]);

  const tenantId = currentTenant?.tenant_id || null;
  const tenantSlug = currentTenant?.tenants?.slug || null;
  const tenantRole = currentTenant?.role || null;
  const isTenantAdmin = tenantRole === "admin" || tenantRole === "owner";
  const isTenantOwner = tenantRole === "owner";
  const tenantBasePath = tenantSlug ? `/t/${tenantSlug}` : "";

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
        tenantBasePath,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);

export { DEFAULT_TENANT_ID };
