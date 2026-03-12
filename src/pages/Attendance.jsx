import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, CalendarCheck, Users, TrendingUp, Bell, ChevronRight, Lock, CheckCircle2, Clock } from "lucide-react";
import SessionFormDialog from "@/components/attendance/SessionFormDialog";
import CheckInPanel from "@/components/attendance/CheckInPanel";
import SelfCheckIn from "@/components/attendance/SelfCheckIn";

const STATUS_BADGE = {
  Open:   "bg-emerald-100 text-emerald-700",
  Closed: "bg-slate-100 text-slate-500",
};

export default function Attendance() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [sendingReminders, setSendingReminders] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => { base44.auth.me().then(setCurrentUser).catch(() => {}); }, []);

  const isAdmin = currentUser?.role === "admin";
  const isUnitLeader = currentUser?.role === "unit_leader";
  const canManage = isAdmin || isUnitLeader;

  const { data: myMemberArr = [] } = useQuery({
    queryKey: ["my-member-att", currentUser?.email],
    queryFn: () => base44.entities.Member.filter({ email: currentUser.email }),
    enabled: !!currentUser?.email,
  });
  const myMember = myMemberArr[0] || null;
  const myUnits = myMember?.church_units || [];

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["attendance-sessions"],
    queryFn: () => base44.entities.AttendanceSession.list("-date", 100),
  });

  const { data: allRecords = [] } = useQuery({
    queryKey: ["attendance-records-all"],
    queryFn: () => base44.entities.AttendanceRecord.list("-created_date", 2000),
  });

  const createSession = useMutation({
    mutationFn: (data) => base44.entities.AttendanceSession.create({ ...data, created_by_name: currentUser?.full_name || "" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] }),
  });

  const deleteSession = useMutation({
    mutationFn: (id) => base44.entities.AttendanceSession.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] }),
  });

  const handleSendReminders = async (session) => {
    setSendingReminders(session.id);
    await base44.functions.invoke("sendAbsenceReminders", { session_id: session.id });
    setSendingReminders(null);
    alert("Absence reminders sent!");
  };

  // All users can see open sessions relevant to them; leaders/admins see all
  const visibleSessions = sessions.filter(s => {
    if (isAdmin) return true;
    if (isUnitLeader) {
      if (s.session_type === "Unit Meeting" && s.unit) return myUnits.includes(s.unit);
      return true;
    }
    // Regular members: see open sessions only (for self-check-in)
    if (s.status !== "Open") return false;
    if (s.session_type === "Unit Meeting" && s.unit) return myUnits.includes(s.unit);
    return true;
  }).filter(s => typeFilter === "All" || s.session_type === typeFilter);

  const getSessionStats = (sessionId) => {
    const recs = allRecords.filter(r => r.session_id === sessionId);
    return {
      total: recs.length,
      present: recs.filter(r => r.status === "Present").length,
      late: recs.filter(r => r.status === "Late").length,
    };
  };

  // Overall stats
  const totalSessions = sessions.length;
  const openSessions = sessions.filter(s => s.status === "Open").length;
  const totalPresent = allRecords.filter(r => r.status === "Present").length;

  const SESSION_TYPES = ["All", "Sunday Service", "Midweek Service", "Unit Meeting", "Special Event", "Prayer Meeting"];

  if (activeSession) {
    // Regular members get a simple self-check-in view
    if (!canManage) {
      return (
        <SelfCheckIn
          session={activeSession}
          member={myMember}
          onClose={() => { setActiveSession(null); queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] }); }}
        />
      );
    }
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-0 shadow-sm p-6">
          <CheckInPanel
            session={activeSession}
            onClose={() => { setActiveSession(null); queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] }); }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm p-4 text-center">
          <CalendarCheck className="h-5 w-5 mx-auto mb-1 text-[#1e3a5f]" />
          <p className="text-2xl font-bold text-slate-800">{totalSessions}</p>
          <p className="text-xs text-slate-400">Total Sessions</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
          <p className="text-2xl font-bold text-emerald-600">{openSessions}</p>
          <p className="text-xs text-slate-400">Open Sessions</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-blue-500" />
          <p className="text-2xl font-bold text-blue-600">{totalPresent}</p>
          <p className="text-xs text-slate-400">Check-ins Total</p>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SESSION_TYPES.map(t => <SelectItem key={t} value={t}>{t === "All" ? "All Types" : t}</SelectItem>)}
          </SelectContent>
        </Select>
        {canManage && (
          <Button onClick={() => setSessionDialogOpen(true)} className="bg-[#1e3a5f] hover:bg-[#152d4a]">
            <Plus className="h-4 w-4 mr-2" /> New Session
          </Button>
        )}
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Loading sessions…</p>
      ) : visibleSessions.length === 0 ? (
        <Card className="border-0 shadow-sm p-16 text-center text-slate-400">
          <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No sessions yet</p>
          {canManage && <p className="text-sm mt-1">Click "New Session" to start taking attendance</p>}
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleSessions.map(session => {
            const stats = getSessionStats(session.id);
            const attendanceRate = stats.total > 0 ? Math.round(((stats.present + stats.late) / stats.total) * 100) : null;
            return (
              <Card key={session.id} className="border-0 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-slate-800">{session.title}</span>
                      <Badge className={`text-[10px] px-2 py-0.5 ${STATUS_BADGE[session.status] || STATUS_BADGE.Closed}`}>
                        {session.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400">{session.date} · {session.session_type}{session.unit ? ` · ${session.unit}` : ""}</p>
                    {stats.total > 0 && (
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-slate-500"><span className="font-semibold text-emerald-600">{stats.present}</span> present</span>
                        {stats.late > 0 && <span className="text-xs text-slate-500"><span className="font-semibold text-amber-500">{stats.late}</span> late</span>}
                        {attendanceRate !== null && (
                          <span className="text-xs text-slate-400">{attendanceRate}% attendance</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {session.status === "Closed" && isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendReminders(session)}
                        disabled={sendingReminders === session.id}
                        className="gap-1.5 text-xs"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        {sendingReminders === session.id ? "Sending…" : "Send Reminders"}
                      </Button>
                    )}
                    {(canManage || session.status === "Open") && (
                      <Button
                        size="sm"
                        variant={session.status === "Open" ? "default" : "outline"}
                        className={session.status === "Open" ? "bg-[#1e3a5f] hover:bg-[#152d4a] gap-1.5 text-xs" : "gap-1.5 text-xs"}
                        onClick={() => setActiveSession(session)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        {session.status === "Open" ? (canManage ? "Check In" : "Check In") : "View"}
                      </Button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => { if (window.confirm("Delete this session?")) deleteSession.mutate(session.id); }}
                        className="text-slate-300 hover:text-red-400 transition-colors p-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <SessionFormDialog
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        onSave={createSession.mutateAsync}
        isAdmin={isAdmin}
        myUnits={myUnits}
      />
    </div>
  );
}