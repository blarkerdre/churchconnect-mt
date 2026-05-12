import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, Clock, XCircle, MinusCircle, Users, X, Lock, Download } from "lucide-react";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const STATUS_CONFIG = {
  Present: { color: "bg-chart-3/10 text-chart-3 border-chart-3/20", icon: CheckCircle2, iconColor: "text-chart-3" },
  Late:    { color: "bg-accent/10 text-accent border-accent/20", icon: Clock, iconColor: "text-accent" },
  Excused: { color: "bg-primary/10 text-primary border-primary/20", icon: MinusCircle, iconColor: "text-primary" },
  Absent:  { color: "bg-muted text-muted-foreground border-border", icon: XCircle, iconColor: "text-muted-foreground" },
};

function downloadReport(session, eligibleMembers, records) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const getRecord = (memberId) => records.find(r => r.member_id === memberId);
  const rows = [
    ["Name", "Status"].join(","),
    ...eligibleMembers.map(m => {
      const status = getRecord(m.id) ? "Present" : "Absent";
      return [esc(`${m.first_name} ${m.last_name}`), status].join(",");
    }),
    "",
    ["Total", eligibleMembers.length].join(","),
    ["Present", records.length].join(","),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance_${session.session_date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CheckInPanel({ session, onClose }) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { tenantId, scopeQuery, withTenant } = useTenantQuery();

  const { data: allMembers = [] } = useQuery({
    queryKey: ["members-checkin", tenantId],
    queryFn: async () => {
      const { data, error } = await scopeQuery(supabase.from("members").select("id, first_name, last_name, email, phone, church_unit, membership_status").order("first_name"));
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
        const { error } = await supabase.from("attendance_records").delete().eq("id", existing.id).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").insert(withTenant({
          session_id: session.id,
          member_id: member.id,
          check_in_method: "manual",
        }));
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-records", session.id] }),
  });

  const removeRecordMutation = useMutation({
    mutationFn: async (recordId) => {
      const { error } = await supabase.from("attendance_records").delete().eq("id", recordId).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-records", session.id] }),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance_sessions").update({ status: "Closed" }).eq("id", session.id).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      onClose();
    },
  });

  const eligibleMembers = useMemo(() => {
    if (session.session_type === "Unit Meeting" && session.unit) {
      const target = session.unit.toLowerCase().trim();
      return allMembers.filter(m =>
        (m.church_unit || "").split(",").map(u => u.trim().toLowerCase()).includes(target)
      );
    }
    return allMembers;
  }, [allMembers, session]);

  const eligibleIds = useMemo(() => new Set(eligibleMembers.map(m => m.id)), [eligibleMembers]);
  const eligibleRecords = useMemo(() => records.filter(r => eligibleIds.has(r.member_id)), [records, eligibleIds]);
  const orphanRecords = useMemo(() => records.filter(r => !eligibleIds.has(r.member_id)), [records, eligibleIds]);
  const memberById = useMemo(() => Object.fromEntries(allMembers.map(m => [m.id, m])), [allMembers]);

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
          <Button variant="outline" size="sm" onClick={() => downloadReport(session, eligibleMembers, eligibleRecords)} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Total", value: eligibleMembers.length, color: "text-foreground" },
          { label: "Present", value: eligibleRecords.length, color: "text-chart-3" },
          { label: "Absent", value: eligibleMembers.length - eligibleRecords.length, color: "text-destructive" },
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

      {session.session_type === "Unit Meeting" && session.unit && orphanRecords.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-destructive">
            Not in this unit ({orphanRecords.length}) — stale check-ins, not counted in stats
          </p>
          {orphanRecords.map(r => {
            const m = memberById[r.member_id];
            return (
              <div key={r.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m ? `${m.first_name} ${m.last_name}` : "Unknown member"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {m?.church_unit || "No unit assigned"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeRecordMutation.mutate(r.id)}
                  className="h-8 text-xs gap-1"
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            );
          })}
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
            onClick={() => { if (window.confirm("Close this meeting?")) closeMutation.mutate(); }}
            className="gap-2 h-11"
          >
            <Lock className="h-4 w-4" /> Close Meeting
          </Button>
        </div>
      )}
    </div>
  );
}
