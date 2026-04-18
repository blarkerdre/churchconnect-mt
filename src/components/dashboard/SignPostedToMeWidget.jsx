import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, Home, ChevronRight, Inbox } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import SignPostDetailPanel from "@/components/followups/SignPostDetailPanel";
import SignPostInboxDialog from "@/components/followups/SignPostInboxDialog";

const statusColors = {
  pending: "bg-accent/10 text-accent",
  contacted: "bg-primary/10 text-primary",
  engaged: "bg-chart-4/10 text-chart-4",
  joined: "bg-chart-3/10 text-chart-3",
  declined: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};

export default function SignPostedToMeWidget() {
  const { tenantId, scopeQuery } = useTenantQuery();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState(null);
  const [inboxOpen, setInboxOpen] = useState(false);

  const { data: referrals = [] } = useQuery({
    queryKey: ["my-signposts", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("followup_referrals")
          .select("id, status, referral_type, target_unit_name, created_at, notes, tenant_id, wsf_centres(name), members(first_name, last_name, phone, email)")
          .eq("assigned_leader_id", user.id)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data;
    },
  });

  if (!referrals.length) return null;

  const visible = referrals.slice(0, 3);
  const moreCount = referrals.length - visible.length;

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            Sign-Posted to You
            <Badge className="bg-accent/10 text-accent border-0 ml-auto">{referrals.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visible.map(r => {
            const isUnit = r.referral_type === "unit_leader";
            const Icon = isUnit ? Users : Home;
            const memberName = r.members ? `${r.members.first_name} ${r.members.last_name}` : "Member";
            const target = isUnit ? r.target_unit_name : (r.wsf_centres?.name || "Home Cell");

            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="w-full text-left bg-muted/40 hover:bg-muted/70 transition-colors rounded-lg p-3 flex items-start gap-2"
              >
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{memberName}</p>
                    <Badge className={`text-[10px] border-0 ${statusColors[r.status] || ""}`}>{r.status}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    via {target} · {format(new Date(r.created_at), "dd MMM")}
                  </p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
              </button>
            );
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInboxOpen(true)}
            className="w-full h-8 text-xs text-primary hover:text-primary mt-1"
          >
            <Inbox className="h-3.5 w-3.5 mr-1.5" />
            {moreCount > 0 ? `View all (${referrals.length})` : "Open Inbox"}
          </Button>
        </CardContent>
      </Card>

      <SignPostDetailPanel
        open={!!selectedId}
        onClose={() => setSelectedId(null)}
        referralId={selectedId}
      />

      <SignPostInboxDialog
        open={inboxOpen}
        onOpenChange={setInboxOpen}
      />
    </>
  );
}
