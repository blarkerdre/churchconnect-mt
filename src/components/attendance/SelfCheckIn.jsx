import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, X, CalendarCheck } from "lucide-react";

export default function SelfCheckIn({ session, member, onClose }) {
  const queryClient = useQueryClient();

  const { data: records = [] } = useQuery({
    queryKey: ["self-checkin-records", session.id, member?.id],
    queryFn: () => base44.entities.AttendanceRecord.filter({ session_id: session.id, member_id: member.id }),
    enabled: !!member?.id,
  });

  const myRecord = records[0] || null;
  const checkedIn = myRecord?.status === "Present" || myRecord?.status === "Late";

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const data = {
        session_id: session.id,
        session_title: session.title,
        session_date: session.date,
        session_type: session.session_type,
        unit: session.unit || "",
        member_id: member.id,
        member_name: `${member.first_name} ${member.last_name}`,
        member_email: member.email || "",
        member_phone: member.phone || "",
        status: "Present",
      };
      if (myRecord) return base44.entities.AttendanceRecord.update(myRecord.id, data);
      return base44.entities.AttendanceRecord.create(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["self-checkin-records", session.id, member?.id] }),
  });

  if (!member) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center text-slate-400">
        <p>Your member profile was not found. Please contact an administrator.</p>
        <Button variant="outline" onClick={onClose} className="mt-4">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <Card className="border-0 shadow-sm p-8 text-center space-y-6">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center gap-2">
          <CalendarCheck className="h-10 w-10 text-[#1e3a5f]" />
          <h2 className="text-lg font-bold text-slate-800">{session.title}</h2>
          <p className="text-sm text-slate-500">{session.date} · {session.session_type}</p>
        </div>

        {checkedIn ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <p className="text-emerald-700 font-semibold text-lg">You're checked in!</p>
            <p className="text-slate-500 text-sm">Attendance recorded for {member.first_name} {member.last_name}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-[#1e3a5f] font-bold text-xl">
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <p className="text-slate-700 font-medium">{member.first_name} {member.last_name}</p>
            <Button
              onClick={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
              className="w-full h-12 text-base bg-[#1e3a5f] hover:bg-[#152d4a]"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              {checkInMutation.isPending ? "Checking in…" : "Check Me In"}
            </Button>
          </div>
        )}

        <Button variant="outline" onClick={onClose} className="w-full">Back to Sessions</Button>
      </Card>
    </div>
  );
}