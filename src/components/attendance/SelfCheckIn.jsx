import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X, CalendarCheck } from "lucide-react";

export default function SelfCheckIn({ session, member, onClose }) {
  const queryClient = useQueryClient();
  const { withTenant } = useTenantQuery();

  const { data: records = [] } = useQuery({
    queryKey: ["self-checkin-records", session.id, member?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("session_id", session.id)
        .eq("member_id", member.id);
      if (error) throw error;
      return data;
    },
    enabled: !!member?.id,
  });

  const myRecord = records[0] || null;
  const checkedIn = !!myRecord;

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (myRecord) return; // Already checked in
      const { error } = await supabase.from("attendance_records").insert({
        session_id: session.id,
        member_id: member.id,
        check_in_method: "self",
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["self-checkin-records", session.id, member?.id] }),
  });

  if (!member) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center text-muted-foreground">
        <p>Your member profile was not found. Please contact an administrator.</p>
        <Button variant="outline" onClick={onClose} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <Card className="border-0 shadow-sm p-8 text-center space-y-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-2">
          <CalendarCheck className="h-10 w-10 text-primary" />
          <h2 className="text-lg font-bold text-foreground">{session.title || session.session_type}</h2>
          <p className="text-sm text-muted-foreground">{session.session_date} · {session.session_type}</p>
        </div>

        {checkedIn ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-full bg-chart-3/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-chart-3" />
            </div>
            <p className="text-chart-3 font-semibold text-lg">You're checked in!</p>
            <p className="text-muted-foreground text-sm">Attendance recorded for {member.first_name} {member.last_name}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <p className="text-foreground font-medium">{member.first_name} {member.last_name}</p>
            <Button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="w-full h-12 text-base"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {checkInMutation.isPending ? "Checking in…" : "Check Me In"}
            </Button>
          </div>
        )}

        <Button variant="outline" onClick={onClose} className="w-full">Back to Meetings</Button>
      </Card>
    </div>
  );
}
