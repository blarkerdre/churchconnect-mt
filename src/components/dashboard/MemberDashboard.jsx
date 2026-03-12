import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, UserCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MemberFeed from "@/components/profile/MemberFeed";

const GROWTH_FIELDS = [
  { key: "water_baptism", label: "Water Baptism" },
  { key: "holy_spirit_baptism", label: "Holy Spirit Baptism" },
  { key: "winners_satellite", label: "WSF" },
  { key: "workers_in_training", label: "WIT" },
  { key: "bfc_completed", label: "BFC" },
  { key: "bcc_completed", label: "BCC" },
  { key: "lcc_completed", label: "LCC" },
  { key: "ldc_completed", label: "LDC" },
];

export default function MemberDashboard({ currentUser, myMember }) {
  const statusColors = {
    Active: "bg-emerald-100 text-emerald-700",
    Inactive: "bg-slate-100 text-slate-500",
    "New Convert": "bg-blue-100 text-blue-700",
    "First Timer": "bg-amber-100 text-amber-700",
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8f] text-white overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-[#c9a84c] flex items-center justify-center text-xl font-bold text-[#0f1f33] shrink-0">
            {myMember ? `${myMember.first_name?.[0]}${myMember.last_name?.[0]}` : currentUser?.full_name?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight">
              Welcome, {myMember?.first_name || currentUser?.full_name || "Member"}!
            </h2>
            <p className="text-white/60 text-sm mt-0.5">Winners Chapel International Cardiff</p>
            {myMember && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={`${statusColors[myMember.membership_status] || "bg-white/20 text-white"} text-xs`}>
                  {myMember.membership_status}
                </Badge>
                {myMember.church_unit && myMember.church_unit !== "None" && (
                  <Badge className="bg-white/20 text-white/90 text-xs">{myMember.church_unit}</Badge>
                )}
                {myMember.winners_satellite && (
                  <Badge className="bg-[#c9a84c]/30 text-[#c9a84c] text-xs">WSF — {myMember.wsf_centre_name || "Member"}</Badge>
                )}
              </div>
            )}
          </div>
          <Link to={createPageUrl("MyProfile")} className="shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">My Profile</span>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Prompt to complete profile */}
      {!myMember && (
        <Link to={createPageUrl("MyProfile")}>
          <Card className="border border-amber-200 bg-amber-50 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-800">Complete your member profile</p>
                <p className="text-xs text-amber-600 mt-0.5">Add your personal details to get the most from the app.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-amber-500 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Feed: Announcements + Events tabs */}
      <MemberFeed member={myMember} />

      {/* Growth Milestones (if member profile linked) */}
      {myMember && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wide">My Growth Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GROWTH_FIELDS.map(({ key, label }) => (
                <div key={key} className={`rounded-xl p-3 text-center border ${myMember[key] ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"}`}>
                  {myMember[key]
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                    : <XCircle className="h-5 w-5 text-slate-300 mx-auto mb-1" />}
                  <p className={`text-xs font-medium ${myMember[key] ? "text-emerald-700" : "text-slate-400"}`}>{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}