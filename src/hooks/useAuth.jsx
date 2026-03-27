import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const noop = async () => ({ data: null, error: new Error("Auth not initialized") });
const AuthContext = createContext({
  user: null, profile: null, roles: [], loading: true, leaderUnits: [], myMember: null,
  tenantMemberships: [],
  signUp: noop, signIn: noop, signOut: noop, resetPassword: noop, updatePassword: noop,
  isAdmin: false, isUnitLeader: false, isWSFLeader: false, isMember: false,
  isTenantOwner: false, isTenantAdmin: false,
  refreshUser: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [leaderUnits, setLeaderUnits] = useState([]);
  const [myMember, setMyMember] = useState(null);
  const [tenantMemberships, setTenantMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id, session.user.email), 0);
        } else {
          setProfile(null);
          setRoles([]);
          setLeaderUnits([]);
          setMyMember(null);
          setTenantMemberships([]);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id, session.user.email);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserData(userId, userEmail) {
    try {
      const [profileRes, rolesRes, unitsRes, memberRes, tmRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("unit_leader_assignments").select("unit_name").eq("user_id", userId),
        supabase.from("members").select("*, wsf_centres!fk_members_wsf_centre(name)").eq("user_id", userId).maybeSingle(),
        supabase.from("tenant_memberships").select("tenant_id, role").eq("user_id", userId),
      ]);

      setProfile(profileRes.data);
      setRoles(rolesRes.data?.map((r) => r.role) || []);
      setLeaderUnits(unitsRes.data?.map((u) => u.unit_name) || []);
      setTenantMemberships(tmRes.data || []);

      setMyMember(memberRes.data);
    } catch (err) {
      console.error("Error fetching user data:", err);
    } finally {
      setLoading(false);
    }
  }

  const signUp = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
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
    setTenantMemberships([]);
  };

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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

  // Bridge: treat tenant owners/admins as app-level admins
  const isAdmin = roles.includes("admin") || roles.includes("super_admin") || isTenantAdmin;
  const isUnitLeader = roles.includes("unit_leader");
  const isWSFLeader = roles.includes("wsf_leader");
  const isMember = roles.includes("member");

  return (
    <AuthContext.Provider
      value={{
        user, profile, roles, loading, leaderUnits, myMember, tenantMemberships,
        signUp, signIn, signOut, resetPassword, updatePassword,
        isAdmin, isUnitLeader, isWSFLeader, isMember,
        isTenantOwner, isTenantAdmin,
        refreshUser: () => user && fetchUserData(user.id, user.email),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
