import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  "Active": "bg-chart-3/10 text-chart-3",
  "Inactive": "bg-muted text-muted-foreground",
  "New Convert": "bg-accent/10 text-accent",
  "First Timer": "bg-chart-4/10 text-chart-4",
  "Visitor": "bg-primary/10 text-primary",
};

export default function MemberJourneyTimeline({ memberId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["member-status-history", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_status_history")
        .select("*")
        .eq("member_id", memberId)
        .order("changed_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!memberId,
  });

  if (isLoading || history.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Member Journey
      </h3>
      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30 text-sm">
            {h.previous_status && (
              <>
                <Badge className={`border-0 text-xs ${statusColors[h.previous_status] || "bg-muted text-muted-foreground"}`}>
                  {h.previous_status}
                </Badge>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </>
            )}
            <Badge className={`border-0 text-xs ${statusColors[h.new_status] || "bg-muted text-muted-foreground"}`}>
              {h.new_status}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">
              {format(new Date(h.changed_at), "dd MMM yyyy")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
