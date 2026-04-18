import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Users, Home, MessageSquarePlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import ReferralUpdateDialog from "@/components/followups/ReferralUpdateDialog";

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
  const queryClient = useQueryClient();
  const [updateRef, setUpdateRef] = useState(null);

  const { data: referrals = [] } = useQuery({
    queryKey: ["my-signposts", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await scopeQuery(
        supabase
          .from("followup_referrals")
          .select("*, wsf_centres(name, location), members(first_name, last_name, phone, email)")
          .eq("assigned_leader_id", user.id)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
      );
      if (error) throw error;
      return data;
    },
  });

  if (!referrals.length) return null;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          Sign-Posted to You
          <Badge className="bg-accent/10 text-accent border-0 ml-auto">{referrals.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {referrals.map(r => {
          const isUnit = r.referral_type === "unit_leader";
          const Icon = isUnit ? Users : Home;
          const memberName = r.members ? `${r.members.first_name} ${r.members.last_name}` : "Member";
          const target = isUnit ? r.target_unit_name : (r.wsf_centres?.name || "Home Cell");

          return (
            <div key={r.id} className="bg-muted/40 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{memberName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      via {target} · {format(new Date(r.created_at), "dd MMM")}
                    </p>
                  </div>
                </div>
                <Badge className={`text-[10px] border-0 ${statusColors[r.status] || ""}`}>{r.status}</Badge>
              </div>
              {r.notes && (
                <p className="text-xs text-foreground/80 bg-background/50 rounded p-2 whitespace-pre-wrap line-clamp-3">{r.notes}</p>
              )}
              {(r.members?.phone || r.members?.email) && (
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {r.members?.phone && <a href={`tel:${r.members.phone}`} className="hover:text-primary">{r.members.phone}</a>}
                  {r.members?.email && <a href={`mailto:${r.members.email}`} className="hover:text-primary">{r.members.email}</a>}
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs w-full"
                onClick={() => setUpdateRef(r)}
              >
                <MessageSquarePlus className="h-3 w-3 mr-1" /> Add Progress Update
              </Button>
            </div>
          );
        })}
      </CardContent>

      <ReferralUpdateDialog
        open={!!updateRef}
        onOpenChange={(v) => !v && setUpdateRef(null)}
        referral={updateRef}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["my-signposts"] });
          setUpdateRef(null);
        }}
      />
    </Card>
  );
}
