import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Lock, CalendarClock } from "lucide-react";
import { format } from "date-fns";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const statusColors = {
  "Open": "bg-accent/10 text-accent",
  "In Progress": "bg-primary/10 text-primary",
  "Resolved": "bg-chart-3/10 text-chart-3",
  "Closed": "bg-muted text-muted-foreground",
};

export default function MemberPastoralHistory({ memberId }) {
  const { tenantId, scopeQuery } = useTenantQuery();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["pastoral_care", memberId, tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase.from("pastoral_care").select("*").eq("member_id", memberId).order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
  });

  if (isLoading) return <p className="text-xs text-muted-foreground py-2">Loading pastoral history...</p>;
  if (!records.length) return <p className="text-xs text-muted-foreground py-2">No pastoral care records for this member.</p>;

  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border text-sm">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-medium text-foreground truncate">{r.subject}</span>
              {r.confidential && <Lock className="h-3 w-3 text-destructive" />}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{r.care_type}</span>
              {r.created_at && <span>• {format(new Date(r.created_at), "d MMM yyyy")}</span>}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColors[r.status] || ""}`}>
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}
