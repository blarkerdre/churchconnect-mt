import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import WSFAttendanceTab from "@/components/wsf/WSFAttendanceTab";
import { useTenantQuery } from "@/hooks/useTenantQuery";

export default function WSFManagement() {
  const { isAdmin, isWSFLeader, user } = useAuth();
  const { tenantId, scopeQuery } = useTenantQuery();

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

  // For WSF leaders (non-admin), find which centres they lead
  const ledCentres = !isAdmin && isWSFLeader && myMember
    ? centres.filter(c => c.leader_id === myMember.id)
    : [];

  const visibleCentres = isAdmin ? centres : ledCentres;

  if (!isAdmin && !isWSFLeader) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          You don't have access to WSF management.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-bold text-foreground">WSF Attendance</h2>
        <p className="text-sm text-muted-foreground">Track attendance for WSF meetings</p>
      </div>
      <WSFAttendanceTab centres={visibleCentres} />
    </div>
  );
}
