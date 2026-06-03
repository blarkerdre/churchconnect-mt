import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import WSFAttendanceTab from "@/components/wsf/WSFAttendanceTab";
import WSFCentreMembersDialog from "@/components/wsf/WSFCentreMembersDialog";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function WSFManagement() {
  const { isAdmin, isWSFLeader, isReportsOfficer, user } = useAuth();
  const { tenantId, scopeQuery } = useTenantQuery();
  const [selectedCentre, setSelectedCentre] = useState(null);

  const { data: myMember } = useQuery({
    queryKey: ["my-member-record", user?.id, tenantId],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("members").select("id").eq("user_id", user.id).eq("tenant_id", tenantId).single();
      return data;
    },
    enabled: !!user?.id && isWSFLeader && !isAdmin,
  });

  const { data: centres = [] } = useQuery({
    queryKey: ["wsf-centres", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("wsf_centres").select("*").order("name"));
      if (error) throw error;
      return data;
    },
  });

  // Get member counts per centre for leaders
  const ledCentres = !isAdmin && isWSFLeader && myMember
    ? centres.filter(c => c.leader_id === myMember.id)
    : [];

  const visibleCentres = isAdmin ? centres : ledCentres;

  const { data: memberCounts = {} } = useQuery({
    queryKey: ["wsf-member-counts", ledCentres.map(c => c.id), tenantId],
    queryFn: async () => {
      const counts = {};
      for (const centre of ledCentres) {
        const { count } = await scopeQuery(
          supabase.from("members").select("id", { count: "exact", head: true }).eq("wsf_centre_id", centre.id)
        );
        counts[centre.id] = count || 0;
      }
      return counts;
    },
    enabled: ledCentres.length > 0,
  });

  if (!isAdmin && !isWSFLeader) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          You don't have access to Home Cell management.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-bold text-foreground">Home Cell Attendance</h2>
        <p className="text-sm text-muted-foreground">Track attendance for Home Cell meetings</p>
      </div>
      <WSFAttendanceTab centres={visibleCentres} />

      {!isAdmin && ledCentres.length > 0 && (
        <>
          <div>
            <h2 className="text-lg font-display font-bold text-foreground">My Centre Members</h2>
            <p className="text-sm text-muted-foreground">View members assigned to your centre</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ledCentres.map(centre => (
              <Card
                key={centre.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors border"
                onClick={() => setSelectedCentre(centre)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{centre.name}</p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {memberCounts[centre.id] ?? "…"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <WSFCentreMembersDialog
            open={!!selectedCentre}
            onOpenChange={(open) => { if (!open) setSelectedCentre(null); }}
            centre={selectedCentre}
            isReadOnly={true}
          />
        </>
      )}
    </div>
  );
}
