import React from "react";
import { AlertCircle, Clock, CalendarClock, CheckCircle2, User, TrendingUp } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";

const priorityDot = {
  Low: "bg-slate-400",
  Medium: "bg-amber-400",
  High: "bg-orange-500",
  Urgent: "bg-red-600",
};
const priorityRing = {
  Low: "border-slate-200 bg-slate-50",
  Medium: "border-amber-200 bg-amber-50",
  High: "border-orange-200 bg-orange-50",
  Urgent: "border-red-200 bg-red-50",
};

function StatBox({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${bg}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function LeaderWorkloadBar({ leaders, records }) {
  if (leaders.length === 0) return null;
  const max = Math.max(...leaders.map((l) => l.count), 1);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <User className="h-4 w-4 text-[#1e3a5f]" /> Leader Workload
      </h3>
      <div className="space-y-3">
        {leaders.map((l) => {
          const open = records.filter(
            (r) => r.assigned_leader === l.name && (r.status === "Open" || r.status === "In Progress")
          ).length;
          return (
            <div key={l.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-600">{l.name}</span>
                <span className="text-xs text-slate-400">{l.count} total · {open} active</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-[#1e3a5f] rounded-full transition-all"
                  style={{ width: `${(l.count / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OverdueList({ overdue, onEdit }) {
  if (overdue.length === 0)
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-rose-500" /> Overdue Follow-ups
        </h3>
        <p className="text-sm text-slate-400 text-center py-4">No overdue follow-ups 🎉</p>
      </div>
    );
  return (
    <div className="bg-white border border-rose-100 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-rose-500" /> Overdue Follow-ups
        <span className="ml-auto bg-rose-100 text-rose-600 text-xs font-bold px-2 py-0.5 rounded-full">{overdue.length}</span>
      </h3>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {overdue.map((r) => (
          <button
            key={r.id}
            onClick={() => onEdit(r)}
            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border ${priorityRing[r.priority] || "border-slate-100 bg-slate-50"} hover:opacity-80 transition`}
          >
            <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${priorityDot[r.priority]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-700 truncate">{r.member_name}</p>
              <p className="text-xs text-slate-500 truncate">{r.title}</p>
              <p className="text-[11px] text-rose-600 mt-0.5">
                Due: {format(parseISO(r.follow_up_date), "d MMM yyyy")}
                {r.assigned_leader && ` · ${r.assigned_leader}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PendingList({ pending, onEdit }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-500" /> Open / Unassigned Requests
        <span className="ml-auto bg-amber-100 text-amber-600 text-xs font-bold px-2 py-0.5 rounded-full">{pending.length}</span>
      </h3>
      {pending.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">All requests are assigned 👍</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {pending.map((r) => (
            <button
              key={r.id}
              onClick={() => onEdit(r)}
              className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-amber-100 bg-amber-50 hover:opacity-80 transition"
            >
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${priorityDot[r.priority]}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700 truncate">{r.member_name}</p>
                <p className="text-xs text-slate-500 truncate">{r.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{r.category} · {r.priority}</p>
              </div>
              {!r.assigned_leader && (
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 shrink-0">Unassigned</Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeaderDashboard({ records, onEdit }) {
  const today = new Date().toISOString().split("T")[0];

  const open = records.filter((r) => r.status === "Open").length;
  const inProgress = records.filter((r) => r.status === "In Progress").length;
  const resolved = records.filter((r) => r.status === "Resolved" || r.status === "Closed").length;
  const overdue = records.filter(
    (r) =>
      r.follow_up_required &&
      r.follow_up_date &&
      r.follow_up_date < today &&
      r.status !== "Resolved" &&
      r.status !== "Closed"
  );
  const pending = records.filter(
    (r) => r.status === "Open" || !r.assigned_leader
  ).sort((a, b) => {
    const order = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  });

  // Build leader list
  const leaderMap = {};
  records.forEach((r) => {
    if (r.assigned_leader) {
      leaderMap[r.assigned_leader] = (leaderMap[r.assigned_leader] || 0) + 1;
    }
  });
  const leaders = Object.entries(leaderMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBox icon={AlertCircle} label="Open Requests" value={open} color="text-amber-600" bg="bg-amber-50" />
        <StatBox icon={Clock} label="In Progress" value={inProgress} color="text-blue-600" bg="bg-blue-50" />
        <StatBox icon={CalendarClock} label="Overdue Follow-ups" value={overdue.length} color="text-rose-600" bg="bg-rose-50" />
        <StatBox icon={CheckCircle2} label="Resolved" value={resolved} color="text-emerald-600" bg="bg-emerald-50" />
      </div>

      {/* Priority Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-[#1e3a5f]" /> Priority Breakdown
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {["Urgent", "High", "Medium", "Low"].map((p) => {
            const count = records.filter((r) => r.priority === p && r.status !== "Resolved" && r.status !== "Closed").length;
            const colors = {
              Urgent: "bg-red-50 border-red-200 text-red-700",
              High: "bg-orange-50 border-orange-200 text-orange-700",
              Medium: "bg-amber-50 border-amber-200 text-amber-700",
              Low: "bg-slate-50 border-slate-200 text-slate-600",
            };
            return (
              <div key={p} className={`rounded-xl border p-3 text-center ${colors[p]}`}>
                <p className="text-xl font-bold">{count}</p>
                <p className="text-xs font-medium mt-0.5">{p}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column: overdue + pending */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <OverdueList overdue={overdue} onEdit={onEdit} />
        <PendingList pending={pending} onEdit={onEdit} />
      </div>

      {/* Leader workload */}
      <LeaderWorkloadBar leaders={leaders} records={records} />
    </div>
  );
}