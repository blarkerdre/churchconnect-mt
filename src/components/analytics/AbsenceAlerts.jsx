import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, UserX, Search, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReEngagementDialog from "./ReEngagementDialog";
import { useTenantQuery } from "@/hooks/useTenantQuery";

export default function AbsenceAlerts({ sessions, records }) {
  const [search, setSearch] = useState("");
  const [minMissed, setMinMissed] = useState(2);
  const [emailTarget, setEmailTarget] = useState(null);
  const { tenantId, scopeQuery } = useTenantQuery();

  const { data: members = [] } = useQuery({
    queryKey: ["members-emails", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("members").select("id, first_name, last_name, email").order("first_name"));
      if (error) throw error;
      return data;
    },
  });

  const memberMap = {};
  members.forEach(m => {
    memberMap[m.id] = m;
  });

  // Sort closed sessions by date descending, take last 10
  const closedSessions = sessions
    .filter(s => s.status === "Closed" && s.session_date)
    .sort((a, b) => b.session_date.localeCompare(a.session_date))
    .slice(0, 10);

  if (closedSessions.length < 2) {
    return (
      <Card className="border-0 shadow-sm p-12 text-center text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Need at least 2 closed sessions to detect absence patterns.</p>
      </Card>
    );
  }

  // Build attendance map: which members attended which sessions
  const allMemberIds = new Set();
  const memberAttendance = {};

  closedSessions.forEach((session, idx) => {
    const sessionRecords = records.filter(r => r.session_id === session.id);
    sessionRecords.forEach(r => {
      allMemberIds.add(r.member_id);
      if (!memberAttendance[r.member_id]) {
        memberAttendance[r.member_id] = new Set();
      }
      memberAttendance[r.member_id].add(idx);
    });
  });

  // Calculate consecutive missed from most recent
  const alerts = Array.from(allMemberIds)
    .map(memberId => {
      const attended = memberAttendance[memberId] || new Set();
      let consecutiveMissed = 0;
      for (let i = 0; i < closedSessions.length; i++) {
        if (!attended.has(i)) consecutiveMissed++;
        else break;
      }
      const m = memberMap[memberId];
      return {
        id: memberId,
        name: m ? `${m.first_name} ${m.last_name}` : "Unknown",
        email: m?.email,
        consecutiveMissed,
      };
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
          <p className="text-2xl font-bold text-destructive">{alerts.length}</p>
          <p className="text-xs text-muted-foreground">Members Flagged</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{critical}</p>
          <p className="text-xs text-muted-foreground">Critical (4+ missed)</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-accent">{warning}</p>
          <p className="text-xs text-muted-foreground">Warning (2–3 missed)</p>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Consecutive Absence Alerts
          </CardTitle>
          <div className="flex items-center gap-3 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-xs" placeholder="Search member..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select
              value={minMissed}
              onChange={e => setMinMissed(Number(e.target.value))}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-card text-foreground"
            >
              <option value={2}>≥2 missed</option>
              <option value={3}>≥3 missed</option>
              <option value={4}>≥4 missed</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <UserX className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No absence alerts — great attendance!</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {filtered.map((m) => {
                const isCritical = m.consecutiveMissed >= 4;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${isCritical ? "bg-destructive/5 border-destructive/20" : "bg-accent/5 border-accent/20"}`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isCritical ? "bg-destructive/10" : "bg-accent/10"}`}>
                      <AlertTriangle className={`h-4 w-4 ${isCritical ? "text-destructive" : "text-accent"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{m.name}</p>
                    </div>
                    <Badge className={`shrink-0 text-xs ${isCritical ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>
                      {m.consecutiveMissed} missed
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title={m.email ? "Send re-engagement email" : "No email on file"}
                      onClick={() => setEmailTarget(m)}
                    >
                      <Mail className={`h-3.5 w-3.5 ${m.email ? "text-primary" : "text-muted-foreground/30"}`} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
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
