import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { trackPageView } from "@/lib/analytics-tracker";

/**
 * Fires an anonymous page-view beacon on every route change,
 * for both public and signed-in pages.
 */
export function usePageViewTracker() {
  const location = useLocation();
  const authedRef = useRef(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) authedRef.current = !!data?.session;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      authedRef.current = !!session;
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      trackPageView({ isAuthenticated: authedRef.current });
    }, 300);
    return () => clearTimeout(t);
  }, [location.pathname, location.search]);
}

export default function PageViewTracker() {
  usePageViewTracker();
  return null;
}
