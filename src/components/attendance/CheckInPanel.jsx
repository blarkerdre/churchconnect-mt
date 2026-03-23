import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, Clock, XCircle, MinusCircle, Users, X, Lock, Download } from "lucide-react";

const STATUS_CONFIG = {
  Present: { color: "bg-chart-3/10 text-chart-3 border-chart-3/20", icon: CheckCircle2, iconColor: "text-chart-3" },
  Late:    { color: "bg-accent/10 text-accent border-accent/20", icon: Clock, iconColor: "text-accent" },
  Excused: { color: "bg-primary/10 text-primary border-primary/20", icon: MinusCircle, iconColor: "text-primary" },
  Absent:  { color: "bg-muted text-muted-foreground border-border", icon: XCircle, iconColor: "text-muted-foreground" },
};

function downloadReport(session, eligibleMembers, records) {
  const getRecord = (memberId) => records.find(r => r.member_id === memberId);
  const lines = [
    `Attendance Report: ${session.title || session.session_type}`,
    `Date: ${session.session_date}`,
    `Type: ${session.session_type}`,
    `---`,
    ...eligibleMembers.map(m => {
      const rec = getRecord(m.id);
      const status = rec ? "Present" : "Absent";
      return `${m.first_name} ${m.last_name} - ${status}`;
    }),
    `---`,
    `Total: ${eligibleMembers.length}`,
    `Present: ${records.length}`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${session.session_date}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CheckInPanel({ session, onClose }) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: allMembers = [] } = useQuery({
    queryKey: ["members-checkin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, first_name, last_name, email, phone, church_unit, membership_status").order("first_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["attendance-records", session.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance_records").select("*").eq("session_id", session.id);
      if (error) throw error;
      return data;
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ member }) => {
      const existing = records.find(r => r.member_id === member.id);
      if (existing) {
        // Toggle off - delete the record
        const { error } = await supabase.from("attendance_records").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").insert({
          session_id: session.id,
          member_id: member.id,
          check_in_method: "manual",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-records", session.id] }),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance_sessions").update({ status: "Closed" }).eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      onClose();
    },
  });

  const eligibleMembers = useMemo(() => {
    if (session.session_type === "Unit Meeting" && session.unit) {
      return allMembers.filter(m => (m.church_unit || "").split(",").map(u => u.trim()).includes(session.unit));
    }
    return allMembers;
  }, [allMembers, session]);

  const filtered = eligibleMembers.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const isCheckedIn = (memberId) => records.some(r => r.member_id === memberId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground leading-tight">{session.title || session.session_type}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{session.session_date} · {session.session_type}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadReport(session, eligibleMembers, records)} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: eligibleMembers.length, color: "text-foreground" },
          { label: "Present", value: records.length, color: "text-chart-3" },
          { label: "Absent", value: eligibleMembers.length - records.length, color: "text-destructive" },
        ].map(s => (
          <div key={s.label} className="bg-muted/50 rounded-xl p-2.5 text-center border border-border">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {(session.male_count > 0 || session.female_count > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-primary/5 rounded-xl p-2.5 text-center border border-primary/10">
            <p className="text-lg font-bold text-primary">{session.male_count}</p>
            <p className="text-[11px] text-muted-foreground">Male</p>
          </div>
          <div className="bg-accent/5 rounded-xl p-2.5 text-center border border-accent/10">
            <p className="text-lg font-bold text-accent">{session.female_count}</p>
            <p className="text-[11px] text-muted-foreground">Female</p>
          </div>
          <div className="bg-muted/50 rounded-xl p-2.5 text-center border border-border">
            <p className="text-lg font-bold text-foreground">{session.total_count}</p>
            <p className="text-[11px] text-muted-foreground">Demo Total</p>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 text-base" />
      </div>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">No members found</p>
        ) : filtered.map(member => {
          const checked = isCheckedIn(member.id);
          return (
            <div
              key={member.id}
              className={`rounded-2xl border-2 transition-all ${checked ? "bg-chart-3/10 border-chart-3/20 shadow-sm" : "border-border bg-card"}`}
            >
              <div className="flex items-center gap-3 p-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${checked ? "bg-card/60" : "bg-primary/10 text-primary"}`}>
                  {member.first_name[0]}{member.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{member.first_name} {member.last_name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{member.church_unit || "No unit"}</p>
                </div>
                <button
                  onClick={() => upsertMutation.mutate({ member })}
                  className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                    checked
                      ? "bg-chart-3 text-chart-3-foreground shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-chart-3/10 hover:text-chart-3"
                  }`}
                >
                  <CheckCircle2 className="h-6 w-6" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {session.status === "open" && (
        <div className="pt-2 border-t border-border flex justify-end">
          <Button
            variant="outline"
            onClick={() => { if (window.confirm("Close this session?")) closeMutation.mutate(); }}
            className="gap-2 h-11"
          >
            <Lock className="h-4 w-4" /> Close Session
          </Button>
        </div>
      )}
    </div>
  );
}
