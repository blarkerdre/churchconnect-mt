import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Platform-wide Trustpilot data (not tenant scoped).
 * Reviews are entered by super admins from the Trustpilot dashboard.
 */
export function useTrustpilotSettings() {
  return useQuery({
    queryKey: ["trustpilot-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trustpilot_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useTrustpilotReviews({ includeUnpublished = false } = {}) {
  return useQuery({
    queryKey: ["trustpilot-reviews", includeUnpublished],
    queryFn: async () => {
      let q = supabase
        .from("trustpilot_reviews")
        .select("*")
        .order("display_order", { ascending: true })
        .order("review_date", { ascending: false, nullsFirst: false });
      if (!includeUnpublished) q = q.eq("is_published", true);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}
