import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Lock, CalendarClock } from "lucide-react";
import { format } from "date-fns";

const statusColors = {
  "Open": "bg-yellow-100 text-yellow-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Resolved": "bg-green-100 text-green-700",
  "Closed": "bg-slate-100 text-slate-500",
};

export default function MemberPastoralHistory({ memberId }) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["pastoral_care", memberId],
    queryFn: () => base44.entities.PastoralCare.filter({ member_id: memberId }, "-date_logged"),
    enabled: !!memberId,
  });

  if (isLoading) return <p className="text-xs text-slate-400 py-2">Loading pastoral history...</p>;
  if (!records.length) return <p className="text-xs text-slate-400 py-2">No pastoral care records for this member.</p>;

  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <span className="font-medium text-slate-800 truncate">{r.title}</span>
              {r.confidential && <Lock className="h-3 w-3 text-red-400" />}
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{r.category}</span>
              {r.date_logged && <span>• {format(new Date(r.date_logged), "d MMM yyyy")}</span>}
              {r.assigned_leader && <span>• {r.assigned_leader}</span>}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColors[r.status]}`}>
            {r.status}
          </span>
        </div>
      ))}
    </div>
  );
}