import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";

function getScoreColor(score) {
  if (score >= 80) return "text-emerald-600 bg-emerald-50";
  if (score >= 50) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

function ScoreBar({ score }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getScoreColor(score)}`}>{score}%</span>
    </div>
  );
}

export default function MemberConsistency({ sessions, records }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("score_asc"); // worst first by default

  // Only use closed sessions for consistency scoring
  const closedSessions = sessions.filter(s => s.status === "Closed");
  const totalSessions = closedSessions.length;

  if (totalSessions === 0) {
    return (
      <Card className="border-0 shadow-sm p-12 text-center text-slate-400">
        <p className="text-sm">No closed sessions yet — consistency scores will appear here once sessions are closed.</p>
      </Card>
    );
  }

  // Build member map from records
  const memberMap = {};
  records.forEach(r => {
    if (!r.member_name) return;
    const key = r.member_id || r.member_name;
    if (!memberMap[key]) {
      memberMap[key] = { name: r.member_name, id: r.member_id, present: 0, late: 0, absent: 0, excused: 0, total: 0 };
    }
    memberMap[key].total++;
    if (r.status === "Present") memberMap[key].present++;
    else if (r.status === "Late") memberMap[key].late++;
    else if (r.status === "Absent") memberMap[key].absent++;
    else if (r.status === "Excused") memberMap[key].excused++;
  });

  let members = Object.values(memberMap).map(m => ({
    ...m,
    score: m.total > 0 ? Math.round(((m.present + m.late) / m.total) * 100) : 0,
  }));

  if (search) {
    members = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
  }

  if (sortBy === "score_asc") members.sort((a, b) => a.score - b.score);
  else if (sortBy === "score_desc") members.sort((a, b) => b.score - a.score);
  else if (sortBy === "name") members.sort((a, b) => a.name.localeCompare(b.name));

  const avgScore = members.length > 0 ? Math.round(members.reduce((s, m) => s + m.score, 0) / members.length) : 0;
  const highCount = members.filter(m => m.score >= 80).length;
  const lowCount = members.filter(m => m.score < 50).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{avgScore}%</p>
          <p className="text-xs text-slate-400">Avg Consistency</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{highCount}</p>
          <p className="text-xs text-slate-400">High (≥80%)</p>
        </Card>
        <Card className="border-0 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{lowCount}</p>
          <p className="text-xs text-slate-400">Low (&lt;50%)</p>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Member Consistency Scores</CardTitle>
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
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-600"
            >
              <option value="score_asc">Worst First</option>
              <option value="score_desc">Best First</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {members.map((m, i) => (
              <div key={m.id || m.name} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-400 w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 truncate">{m.name}</p>
                  <p className="text-[10px] text-slate-400">{m.present}P · {m.late}L · {m.absent}A · {m.total} sessions</p>
                </div>
                <ScoreBar score={m.score} />
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-8">No members found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}