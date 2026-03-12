import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, UserX, Search, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import ReEngagementDialog from "./ReEngagementDialog";

export default function AbsenceAlerts({ sessions, records }) {
  const [search, setSearch] = useState("");
  const [minMissed, setMinMissed] = useState(2);
  const [emailTarget, setEmailTarget] = useState(null);

  const { data: members = [] } = useQuery({
    queryKey: ["members-emails"],
    queryFn: () => base44.entities.Member.list("-created_date", 500),
  });

  // Build a quick email lookup by member_id or name
  const memberEmailMap = {};
  members.forEach(m => {
    memberEmailMap[m.id] = m.email;
    const fullName = `${m.first_name} ${m.last_name}`.trim().toLowerCase();
    if (!memberEmailMap[fullName]) memberEmailMap[fullName] = m.email;
  });

  const getMemberEmail = (alert) => {
    if (alert.id && memberEmailMap[alert.id]) return memberEmailMap[alert.id];
    const key = alert.name?.trim().toLowerCase();
    return memberEmailMap[key] || null;
  };

  // Sort closed sessions by date descending, take last 10
  const closedSessions = sessions
    .filter(s => s.status === "Closed" && s.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  if (closedSessions.length < 2) {
    return (
      <Card className="border-0 shadow-sm p-12 text-center text-slate-400">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Need at least 2 closed sessions to detect absence patterns.</p>
      </Card>
    );
  }

  const memberSessionMap = {};
  closedSessions.forEach((session, idx) => {
    const sessionRecords = records.filter(r => r.session_id === session.id);
    sessionRecords.forEach(r => {
      const key = r.member_id || r.member_name;
      if (!memberSessionMap[key]) {
        memberSessionMap[key] = { name: r.member_name, id: r.member_id, sessions: new Array(closedSessions.length).fill(null) };
      }
      memberSessionMap[key].sessions[idx] = r.status;
    });
  });

  const alerts = Object.values(memberSessionMap)
    .map(member => {
      let consecutiveMissed = 0;
      for (let i = 0; i < member.sessions.length; i++) {
        const status = member.sessions[i];
        if (status === null || status === "Absent") consecutiveMissed++;
        else break;
      }
      return { ...member, consecutiveMissed };
    })
    .filter(m => m.consecutiveMissed >= minMissed)
    .sort((a, b) => b.consecutiveMissed - a.consecutiveMissed);

  const filtered = search ? alerts.filter(m => m.name.toLowerCase().includes(search.toLowerCase())) : alerts;

  const critical = filtered.filter(m => m.consecutiveMissed >= 4).length;
  const warning = filtered.filter(m => m.consecutiveMissed >= 2 && m.consecutiveMissed < 4).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{alerts.length}</p>
          <p className="text-xs text-slate-400">Members Flagged</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{critical}</p>
          <p className="text-xs text-slate-400">Critical (4+ missed)</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{warning}</p>
          <p className="text-xs text-slate-400">Warning (2–3 missed)</p>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Consecutive Absence Alerts
          </CardTitle>
          <div className="flex items-center gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                className="pl-8 h-8 text-xs"
                placeholder="Search member..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              value={minMissed}
              onChange={e => setMinMissed(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600"
            >
              <option value={2}>≥2 missed</option>
              <option value={3}>≥3 missed</option>
              <option value={4}>≥4 missed</option>
              <option value={5}>≥5 missed</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <UserX className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No absence alerts — great attendance!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {filtered.map((m) => {
                const isCritical = m.consecutiveMissed >= 4;
                const email = getMemberEmail(m);
                return (
                  <div
                    key={m.id || m.name}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${isCritical ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isCritical ? "bg-red-100" : "bg-amber-100"}`}>
                      <AlertTriangle className={`h-4 w-4 ${isCritical ? "text-red-500" : "text-amber-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{m.name}</p>
                      <p className="text-[10px] text-slate-500">
                        Session history (recent→old):{" "}
                        {m.sessions.slice(0, 6).map((s, idx) => (
                          <span
                            key={idx}
                            className={`inline-block w-3 h-3 rounded-full mr-0.5 ${
                              s === "Present" ? "bg-emerald-400"
                              : s === "Late" ? "bg-amber-400"
                              : s === "Excused" ? "bg-blue-400"
                              : s === "Absent" ? "bg-red-400"
                              : "bg-slate-200"
                            }`}
                            title={s || "No record"}
                          />
                        ))}
                      </p>
                    </div>
                    <Badge className={`shrink-0 text-xs ${isCritical ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {m.consecutiveMissed} missed
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title={email ? "Send re-engagement email" : "No email on file"}
                      onClick={() => setEmailTarget({ ...m, email })}
                    >
                      <Mail className={`h-3.5 w-3.5 ${email ? "text-[#1e3a5f]" : "text-slate-300"}`} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-3">Based on the {closedSessions.length} most recent closed sessions. Coloured dots: 🟢 Present · 🟡 Late · 🔵 Excused · 🔴 Absent · ⚪ No record</p>
        </CardContent>
      </Card>

      {emailTarget && (
        <ReEngagementDialog
          open={!!emailTarget}
          onOpenChange={(v) => { if (!v) setEmailTarget(null); }}
          member={emailTarget}
        />
      )}
    </div>
  );
}