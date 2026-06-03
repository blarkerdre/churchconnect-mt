import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const noop = async () => ({ data: null, error: new Error("Auth not initialized") });
const SESSION_RESTORE_TIMEOUT_MS = 6000;

const withTimeout = (promise, timeoutMs, message) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const AuthContext = createContext({
  user: null, profile: null, roles: [], loading: true, leaderUnits: [], leaderCentres: [], myMember: null,
  tenantMemberships: [],
  signUp: noop, signIn: noop, signOut: noop, resetPassword: noop, updatePassword: noop,
  isAdmin: false, isUnitLeader: false, isWSFLeader: false, isMember: false, isReportsOfficer: false,
  isTenantOwner: false, isTenantAdmin: false,
  refreshUser: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
   const [leaderUnits, setLeaderUnits] = useState([]);
   const [leaderCentres, setLeaderCentres] = useState([]);
  const [myMember, setMyMember] = useState(null);
  const [tenantMemberships, setTenantMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setLoading(false);
          setDataLoaded(false);
          setTimeout(() => fetchUserData(session.user.id, session.user.email), 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLeaderUnits([]);
          setMyMember(null);
          setLeaderCentres([]);
          setTenantMemberships([]);
          setLoading(false);
          setDataLoaded(true);
        }
      }
    );

    withTimeout(
      supabase.auth.getSession(),
      SESSION_RESTORE_TIMEOUT_MS,
      "Session restore timed out"
    )
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (session?.user) {
          setDataLoaded(false);
          fetchUserData(session.user.id, session.user.email);
        } else {
          setDataLoaded(true);
        }
      })
      .catch((err) => {
        console.warn("Unable to restore auth session:", err?.message || err);
        setUser(null);
        setProfile(null);
        setRoles([]);
        setLeaderUnits([]);
        setMyMember(null);
        setLeaderCentres([]);
        setTenantMemberships([]);
        setLoading(false);
        setDataLoaded(true);
      });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserData(userId, userEmail) {
    // Hard safety net: if Supabase calls hang (e.g., preview proxy issues),
    // unblock the UI after 5s so /auth can redirect instead of stalling.
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setDataLoaded(true);
    }, 5000);

    try {
      const [profileRes, rolesRes, unitsRes, memberRes, tmRes] = await Promise.allSettled([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("unit_leader_assignments").select("unit_name").eq("user_id", userId),
        supabase.from("members").select("*, wsf_centres!fk_members_wsf_centre(name)").eq("user_id", userId).maybeSingle(),
        supabase.from("tenant_memberships").select("tenant_id, role, tenants(slug)").eq("user_id", userId),
      ]);

      const profileData = profileRes.status === "fulfilled" ? profileRes.value.data : null;
      const rolesData = rolesRes.status === "fulfilled" ? rolesRes.value.data : null;
      const unitsData = unitsRes.status === "fulfilled" ? unitsRes.value.data : null;
      const memberData = memberRes.status === "fulfilled" ? memberRes.value.data : null;
      const tmData = tmRes.status === "fulfilled" ? tmRes.value.data : null;

      setProfile(profileData);
      setRoles(rolesData?.map((r) => r.role) || []);
      setLeaderUnits(unitsData?.map((u) => u.unit_name) || []);
      setTenantMemberships(tmData || []);
      setMyMember(memberData);

      // Fetch WSF centres led by this user (via their member record)
      if (memberData?.id) {
        try {
          const { data: centres } = await supabase
            .from("wsf_centres")
            .select("name")
            .eq("leader_id", memberData.id);
          setLeaderCentres(centres?.map((c) => c.name) || []);
        } catch {
          setLeaderCentres([]);
        }
      } else {
        setLeaderCentres([]);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      clearTimeout(safetyTimer);
      setLoading(false);
      setDataLoaded(true);
    }
  }

  const signUp = async (email, password, fullName, tenantSlug) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, ...(tenantSlug ? { tenant_slug: tenantSlug } : {}) },
        emailRedirectTo: tenantSlug
          ? `${window.location.origin}/t/${tenantSlug}`
          : window.location.origin,
      },
    });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRoles([]);
    setLeaderUnits([]);
     setMyMember(null);
     setLeaderCentres([]);
     setTenantMemberships([]);
  };

  const resetPassword = async (email, tenantSlug) => {
    const redirectTo = tenantSlug
      ? `${window.location.origin}/t/${tenantSlug}/reset-password`
      : `${window.location.origin}/reset-password`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { data, error };
  };

  const updatePassword = async (password) => {
    const { data, error } = await supabase.auth.updateUser({ password });
    return { data, error };
  };

  // Derive tenant-level admin status
  const isTenantOwner = tenantMemberships.some((m) => m.role === "owner");
  const isTenantAdmin = tenantMemberships.some((m) => m.role === "owner" || m.role === "admin");

  const isReportsOfficer = roles.includes("reports_officer");
  // Bridge: treat tenant owners/admins as app-level admins
  const isAdmin = roles.includes("admin") || roles.includes("super_admin") || isTenantAdmin;
  const isUnitLeader = roles.includes("unit_leader");
  const isWSFLeader = roles.includes("wsf_leader");
  const isMember = roles.includes("member");
  // Reports Officer is read-only unless they ALSO hold a write-capable role
  const isReadOnly = isReportsOfficer && !isAdmin && !isUnitLeader && !isWSFLeader;

  return (
    <AuthContext.Provider
       value={{
        user, profile, roles, loading, dataLoaded, leaderUnits, leaderCentres, myMember, tenantMemberships,
        signUp, signIn, signOut, resetPassword, updatePassword,
        isAdmin, isUnitLeader, isWSFLeader, isMember, isReportsOfficer, isReadOnly,
        isTenantOwner, isTenantAdmin,
        refreshUser: () => user && fetchUserData(user.id, user.email),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
