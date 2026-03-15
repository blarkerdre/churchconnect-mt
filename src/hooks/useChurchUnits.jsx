import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useChurchUnits(activeOnly = true) {
  return useQuery({
    queryKey: ["church-units", activeOnly],
    queryFn: async () => {
      let q = supabase.from("church_units").select("*").order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
