import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/components/useCurrentUser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, Lock, CalendarClock, User, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import PastoralCareRequestDialog from "@/components/pastoralcare/PastoralCareRequestDialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const statusColors = {
  "Open": "bg-yellow-100 text-yellow-700 border-yellow-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  "Resolved": "bg-green-100 text-green-700 border-green-200",
  "Closed": "bg-slate-100 text-slate-500 border-slate-200",
};

const categoryColors = {
  "Prayer Request": "bg-violet-100 text-violet-700",
  "Counselling Session": "bg-blue-100 text-blue-700",
  "Visitation": "bg-emerald-100 text-emerald-700",
  "Hospital Visit": "bg-red-100 text-red-700",
  "Bereavement Support": "bg-slate-100 text-slate-700",
  "Marriage Support": "bg-pink-100 text-pink-700",
  "Financial Support": "bg-amber-100 text-amber-700",
  "Spiritual Direction": "bg-indigo-100 text-indigo-700",
  "General Pastoral Need": "bg-teal-100 text-teal-700",
  "Other": "bg-gray-100 text-gray-700",
};

const statusIcon = {
  "Open": AlertCircle,
  "In Progress": Clock,
  "Resolved": CheckCircle2,
  "Closed": CheckCircle2,
};

export default function MyPastoralCare() {
  const { user } = useCurrentUser();
  const [requestOpen, setRequestOpen] = useState(false);

  // Fetch my member profile
  const { data: members = [], isLoading: loadingMember } = useQuery({
    queryKey: ["my-member-pastoral", user?.email],
    queryFn: () => base44.entities.Member.filter({ email: user.email }),
    enabled: !!user?.email,
  });
  const myMember = members[0] || null;

  // Fetch my pastoral care records by member_id or member_name
  const { data: allRecords = [], isLoading: loadingRecords } = useQuery({
    queryKey: ["my-pastoral-care", myMember?.id, user?.full_name],
    queryFn: async () => {
      if (myMember?.id) {
        return base44.entities.PastoralCare.filter({ member_id: myMember.id }, "-date_logged", 100);
      }
      return [];
    },
    enabled: !!myMember,
  });

  const isLoading = loadingMember || loadingRecords;

  const open = allRecords.filter(r => r.status === "Open").length;
  const inProgress = allRecords.filter(r => r.status === "In Progress").length;
  const resolved = allRecords.filter(r => r.status === "Resolved" || r.status === "Closed").length;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Pastoral Care</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your prayer & pastoral support requests</p>
        </div>
        <Button onClick={() => setRequestOpen(true)} className="bg-rose-500 hover:bg-rose-600 text-white">
          <Heart className="h-4 w-4 mr-2" /> New Request
        </Button>
      </div>

      {/* Stats */}
      {!isLoading && allRecords.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Open", value: open, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "In Progress", value: inProgress, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Resolved", value: resolved, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-4 ${s.bg} text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Records */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : allRecords.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <Heart className="h-7 w-7 text-rose-300" />
            </div>
            <p className="font-medium text-slate-700">No requests yet</p>
            <p className="text-sm text-slate-400 mt-1">Submit a request and a pastoral leader will follow up with you.</p>
            <Button onClick={() => setRequestOpen(true)} className="mt-4 bg-rose-500 hover:bg-rose-600 text-white" size="sm">
              Make a Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allRecords.map(record => {
            const StatusIcon = statusIcon[record.status] || AlertCircle;
            return (
              <Card key={record.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      record.status === "Resolved" || record.status === "Closed" ? "bg-emerald-50" :
                      record.status === "In Progress" ? "bg-blue-50" : "bg-amber-50"
                    }`}>
                      <StatusIcon className={`h-4 w-4 ${
                        record.status === "Resolved" || record.status === "Closed" ? "text-emerald-500" :
                        record.status === "In Progress" ? "text-blue-500" : "text-amber-500"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[record.category] || "bg-gray-100 text-gray-700"}`}>
                          {record.category}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${statusColors[record.status]}`}>
                          {record.status}
                        </span>
                        {record.confidential && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-500">
                            <Lock className="h-3 w-3" /> Confidential
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-800 text-sm">{record.title}</p>
                      {record.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{record.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                        {record.date_logged && <span>Logged: {format(new Date(record.date_logged), "d MMM yyyy")}</span>}
                        {record.assigned_leader && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {record.assigned_leader}
                          </span>
                        )}
                        {record.follow_up_required && record.follow_up_date && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <CalendarClock className="h-3 w-3" /> Follow-up: {format(new Date(record.follow_up_date), "d MMM")}
                          </span>
                        )}
                      </div>
                      {record.outcome && (
                        <div className="mt-3 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                          <p className="text-xs font-medium text-slate-600 mb-0.5">Leader's Update</p>
                          <p className="text-xs text-slate-500">{record.outcome}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PastoralCareRequestDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        currentUser={user}
        myMember={myMember}
      />
    </div>
  );
}