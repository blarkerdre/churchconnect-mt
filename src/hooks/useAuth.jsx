import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [roles, setRoles] = useState([]);
  const [leaderUnits, setLeaderUnits] = useState([]);
  const [myMember, setMyMember] = useState(null);
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
      const [profileRes, rolesRes, unitsRes, memberRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("unit_leader_assignments").select("unit_name").eq("user_id", userId),
        supabase.from("members").select("*, wsf_centres!fk_members_wsf_centre(name)").eq("user_id", userId).maybeSingle(),
      ]);

      setProfile(profileRes.data);
      setRoles(rolesRes.data?.map((r) => r.role) || []);
      setLeaderUnits(unitsRes.data?.map((u) => u.unit_name) || []);

      let member = memberRes.data;

      if (!member && userEmail) {
        const { data: claimedMemberId, error: claimError } = await supabase.rpc("claim_own_member_profile");

        if (claimError) {
          console.error("Error claiming member profile:", claimError);
        } else if (claimedMemberId) {
          const { data: linkedMember, error: linkedMemberError } = await supabase
            .from("members")
            .select("*, wsf_centres!fk_members_wsf_centre(name)")
            .eq("id", claimedMemberId)
            .maybeSingle();

          if (linkedMemberError) {
            console.error("Error loading claimed member profile:", linkedMemberError);
          } else {
            member = linkedMember;
          }
        }
      }

      setMyMember(member);
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

  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const isUnitLeader = roles.includes("unit_leader");
  const isWSFLeader = roles.includes("wsf_leader");
  const isMember = roles.includes("member");

  return (
    <AuthContext.Provider
      value={{
        user, profile, roles, loading, leaderUnits, myMember,
        signUp, signIn, signOut, resetPassword, updatePassword,
        isAdmin, isUnitLeader, isWSFLeader, isMember,
        refreshUser: () => user && fetchUserData(user.id, user.email),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
