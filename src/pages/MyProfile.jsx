import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Phone, MapPin, Calendar, CheckCircle2, XCircle, Church } from "lucide-react";
import { format } from "date-fns";

export default function MyProfile() {
  const { user } = useAuth();

  const { data: member, isLoading } = useQuery({
    queryKey: ["my-member-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*, wsf_centres(name)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["my-attendance", member?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, attendance_sessions(title, session_date, session_type)")
        .eq("member_id", member.id)
        .order("checked_in_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!member?.id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!member) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-40" />
          <p className="text-lg font-medium">No member profile linked</p>
          <p className="text-sm mt-1">Please contact an administrator to link your account to a member record.</p>
        </CardContent>
      </Card>
    );
  }

  const BoolBadge = ({ value, label }) => (
    <div className="flex items-center gap-2 text-sm">
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/40" />
      )}
      <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Profile Header */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground">{member.first_name} {member.last_name}</h2>
              <Badge variant="outline" className="mt-1">{member.membership_status}</Badge>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm text-muted-foreground">
                {member.email && (
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4" />{member.email}</div>
                )}
                {member.phone && (
                  <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{member.phone}</div>
                )}
                {(member.address || member.city) && (
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{[member.address, member.city, member.postcode].filter(Boolean).join(", ")}</div>
                )}
                {member.membership_date && (
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />Member since {format(new Date(member.membership_date), "MMM yyyy")}</div>
                )}
                {member.church_unit && (
                  <div className="flex items-center gap-2"><Church className="h-4 w-4" />{member.church_unit}</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Growth Milestones */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Growth Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <BoolBadge value={member.water_baptism} label="Water Baptism" />
            <BoolBadge value={member.holy_spirit_baptism} label="HS Baptism" />
            <BoolBadge value={member.bfc_completed} label="BFC Completed" />
            <BoolBadge value={member.bcc_completed} label="BCC Completed" />
            <BoolBadge value={member.lcc_completed} label="LCC Completed" />
            <BoolBadge value={member.ldc_completed} label="LDC Completed" />
            <BoolBadge value={member.workers_in_training} label="Workers in Training" />
            <BoolBadge value={member.winners_satellite} label="Winners Satellite" />
          </div>
          {member.wsf_centres?.name && (
            <p className="text-sm text-muted-foreground mt-3">WSF Centre: <span className="text-foreground font-medium">{member.wsf_centres.name}</span></p>
          )}
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Attendance ({attendanceRecords.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No attendance records found.</p>
          ) : (
            <div className="space-y-2">
              {attendanceRecords.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {r.attendance_sessions?.title || r.attendance_sessions?.session_type || "Service"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.attendance_sessions?.session_date && format(new Date(r.attendance_sessions.session_date), "dd MMM yyyy")}
                      {r.attendance_sessions?.session_type && ` · ${r.attendance_sessions.session_type}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Present</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
