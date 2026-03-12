import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, CheckCircle2, Clock, XCircle, MinusCircle, Users, X, Lock, Download } from "lucide-react";

const STATUS_CONFIG = {
  Present: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2, iconColor: "text-emerald-600" },
  Late:    { color: "bg-amber-100 text-amber-700 border-amber-200",   icon: Clock,        iconColor: "text-amber-500" },
  Excused: { color: "bg-blue-100 text-blue-700 border-blue-200",     icon: MinusCircle,  iconColor: "text-blue-500" },
  Absent:  { color: "bg-slate-100 text-slate-500 border-slate-200",  icon: XCircle,      iconColor: "text-slate-400" },
};

function downloadCSV(session, eligibleMembers, records) {
  const getStatus = (memberId) => records.find(r => r.member_id === memberId)?.status || "Absent";
  const rows = [
    ["Name", "Status", "Session", "Date", "Type"],
    ...eligibleMembers.map(m => [
      `${m.first_name} ${m.last_name}`,
      getStatus(m.id),
      session.title,
      session.date,
      session.session_type,
    ])
  ];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${session.title.replace(/\s+/g, "_")}_attendance.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CheckInPanel({ session, onClose }) {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // All members
  const { data: allMembers = [] } = useQuery({
    queryKey: ["members-checkin"],
    queryFn: () => base44.entities.Member.list("-first_name", 500),
  });

  // Existing records for this session
  const { data: records = [] } = useQuery({
    queryKey: ["attendance-records", session.id],
    queryFn: () => base44.entities.AttendanceRecord.filter({ session_id: session.id }),
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ member, status }) => {
      const existing = records.find(r => r.member_id === member.id);
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
        status,
      };
      if (existing) {
        return base44.entities.AttendanceRecord.update(existing.id, data);
      } else {
        return base44.entities.AttendanceRecord.create(data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-records", session.id] }),
  });

  const closeMutation = useMutation({
    mutationFn: () => base44.entities.AttendanceSession.update(session.id, { status: "Closed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-sessions"] });
      onClose();
    },
  });

  // Filter members: if unit meeting, show only members of that unit
  const eligibleMembers = useMemo(() => {
    if (session.session_type === "Unit Meeting" && session.unit) {
      return allMembers.filter(m => (m.church_units || []).includes(session.unit));
    }
    return allMembers;
  }, [allMembers, session]);

  const filtered = eligibleMembers.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const getStatus = (memberId) => records.find(r => r.member_id === memberId)?.status || null;

  const presentCount = records.filter(r => r.status === "Present").length;
  const lateCount = records.filter(r => r.status === "Late").length;
  const excusedCount = records.filter(r => r.status === "Excused").length;

  const [filterStatus, setFilterStatus] = useState("All");

  const displayMembers = useMemo(() => {
    return filtered.filter(m => {
      if (filterStatus === "All") return true;
      if (filterStatus === "Unmarked") return !getStatus(m.id);
      return getStatus(m.id) === filterStatus;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, records, filterStatus]);

  return (
    <div className="flex flex-col gap-3">
      {/* Session header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 leading-tight">{session.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{session.date} · {session.session_type}{session.unit ? ` · ${session.unit}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(session, eligibleMembers, records)} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Download
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Total", value: eligibleMembers.length, color: "text-slate-700" },
          { label: "Present", value: presentCount, color: "text-emerald-600" },
          { label: "Late", value: lateCount, color: "text-amber-500" },
          { label: "Excused", value: excusedCount, color: "text-blue-500" },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 text-base" />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
        {["All", "Unmarked", "Present", "Late", "Excused"].map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filterStatus === f
                ? "bg-[#1e3a5f] text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {f}
            {f === "Unmarked" && (
              <span className="ml-1 text-[10px]">({eligibleMembers.length - records.length < 0 ? 0 : eligibleMembers.length - records.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Member cards — mobile-optimised tap targets */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto -mx-1 px-1">
        {displayMembers.length === 0 ? (
          <p className="text-center text-slate-400 py-10 text-sm">No members found</p>
        ) : displayMembers.map(member => {
          const status = getStatus(member.id);
          const cfg = status ? STATUS_CONFIG[status] : null;
          return (
            <div
              key={member.id}
              className={`rounded-2xl border-2 transition-all ${
                status
                  ? cfg.color + " shadow-sm"
                  : "border-slate-200 bg-white"
              }`}
            >
              {/* Top row: avatar + name + quick Present tap */}
              <div className="flex items-center gap-3 p-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${status ? "bg-white/60" : "bg-[#1e3a5f]/10 text-[#1e3a5f]"}`}>
                  {member.first_name[0]}{member.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{member.first_name} {member.last_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{(member.church_units || []).slice(0,2).join(", ") || "No unit"}</p>
                </div>
                {/* Big Present button — primary action */}
                <button
                  onClick={() => upsertMutation.mutate({ member, status: status === "Present" ? "Absent" : "Present" })}
                  className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                    status === "Present"
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-500"
                  }`}
                >
                  <CheckCircle2 className="h-6 w-6" />
                </button>
              </div>

              {/* Secondary actions row */}
              <div className="flex gap-1.5 px-3 pb-3">
                {[
                  { s: "Late", icon: Clock, label: "Late" },
                  { s: "Excused", icon: MinusCircle, label: "Excused" },
                ].map(({ s, icon: Icon, label }) => {
                  const isActive = status === s;
                  const scfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => upsertMutation.mutate({ member, status: isActive ? "Absent" : s })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 border ${
                        isActive ? scfg.color : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Close session */}
      {session.status === "Open" && (
        <div className="pt-2 border-t border-slate-100 flex justify-end">
          <Button
            variant="outline"
            onClick={() => { if (window.confirm("Close this session? This will mark all unchecked members as Absent.")) closeMutation.mutate(); }}
            className="text-slate-600 gap-2 h-11"
          >
            <Lock className="h-4 w-4" /> Close Session
          </Button>
        </div>
      )}
    </div>
  );
}