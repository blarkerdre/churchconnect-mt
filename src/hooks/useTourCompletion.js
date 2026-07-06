import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const cacheKey = (userId, tourId) => `tour:completed:${userId}:${tourId}`;

// Lightweight in-process pub/sub so writes from TourProvider (or any other
// call site) immediately flip the `completed` state of every hook instance
// watching the same tour. Without this, a Skip/Close on an auto-run tour
// leaves stale `completed=false` in useAutoTour, which then re-triggers the
// tour when the TourProvider context value changes.
const listeners = new Set();
export function notifyTourCompletion(userId, tourId) {
  try {
    if (userId && tourId) {
      localStorage.setItem(cacheKey(userId, tourId), "1");
    }
  } catch {}
  listeners.forEach((fn) => {
    try { fn({ userId, tourId }); } catch {}
  });
}

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
      // Never overwrite a "true" already known from localStorage or a live
      // in-session dismissal — otherwise a race between the fetch and a
      // Skip click would flip completed back to false and re-trigger auto.
      setCompleted((prev) => (prev === true ? true : done));
      try {
        if (done) localStorage.setItem(cacheKey(user.id, tourId), "1");
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [user?.id, tourId]);

  // Subscribe to in-process completion notifications.
  useEffect(() => {
    if (!user?.id || !tourId) return;
    const fn = ({ userId, tourId: tid }) => {
      if (userId === user.id && tid === tourId) setCompleted(true);
    };
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, [user?.id, tourId]);

  const markCompleted = useCallback(async () => {
    if (!user?.id || !tourId) return;
    setCompleted(true);
    notifyTourCompletion(user.id, tourId);
    await supabase
      .from("user_tour_completions")
      .upsert({ user_id: user.id, tour_id: tourId, completed_at: new Date().toISOString() });
  }, [user?.id, tourId]);

  return { completed, markCompleted };
}
