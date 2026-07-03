import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const cacheKey = (userId, tourId) => `tour:completed:${userId}:${tourId}`;

export function useTourCompletion(tourId) {
  const { user } = useAuth();
  const [completed, setCompleted] = useState(() => {
    if (!user?.id) return null;
    try {
      return localStorage.getItem(cacheKey(user.id, tourId)) === "1";
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!user?.id || !tourId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_tour_completions")
        .select("tour_id")
        .eq("user_id", user.id)
        .eq("tour_id", tourId)
        .maybeSingle();
      if (cancelled) return;
      const done = !!data;
      setCompleted(done);
      try {
        if (done) localStorage.setItem(cacheKey(user.id, tourId), "1");
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user?.id, tourId]);

  const markCompleted = useCallback(async () => {
    if (!user?.id || !tourId) return;
    setCompleted(true);
    try { localStorage.setItem(cacheKey(user.id, tourId), "1"); } catch {}
    await supabase
      .from("user_tour_completions")
      .upsert({ user_id: user.id, tour_id: tourId, completed_at: new Date().toISOString() });
  }, [user?.id, tourId]);

  return { completed, markCompleted };
}
