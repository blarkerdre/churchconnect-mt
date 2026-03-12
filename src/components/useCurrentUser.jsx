import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const isAdmin = user?.role === "admin";
  const isUnitLeader = user?.role === "unit_leader";
  const isUser = !isAdmin && !isUnitLeader;

  return { user, loading, isAdmin, isUnitLeader, isUser };
}