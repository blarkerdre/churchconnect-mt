import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, UserCircle, ChevronRight, Star, Cake } from "lucide-react";
import { Link } from "react-router-dom";
import MemberFeed from "@/components/profile/MemberFeed";
import SelfCheckInWidget from "@/components/attendance/SelfCheckInWidget";

import { BirthdayBanner, UpcomingBirthdayItem } from "@/components/dashboard/BirthdayCelebration";
import { useTenant } from "@/contexts/TenantContext";
import ImageLightbox from "@/components/ui/ImageLightbox";
import DashboardBanner from "@/components/dashboard/DashboardBanner";
import AppFeedbackDialog from "@/components/feedback/AppFeedbackDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const GROWTH_FIELDS = [
  { key: "water_baptism", label: "Water Baptism" },
  { key: "holy_spirit_baptism", label: "Holy Spirit Baptism" },
  { key: "winners_satellite", label: "Home Cell" },
  { key: "bfc_completed", label: "BFC" },
  { key: "bcc_completed", label: "BCC" },
  { key: "lcc_completed", label: "LCC" },
  { key: "ldc_completed", label: "LDC" },
];

export default function MemberDashboard({ currentUser, myMember }) {
  const { currentTenant, tenantRole } = useTenant();
  const { session } = useAuth();
  const { tenantId } = useTenantQuery();
  const roleLabel = tenantRole ? tenantRole.charAt(0).toUpperCase() + tenantRole.slice(1) : "";
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const userId = session?.user?.id;

  const { data: existingFeedback } = useQuery({
    queryKey: ["app-feedback-own", tenantId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_feedback")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!tenantId,
  });

  const statusColors = {
    Active: "bg-chart-3/10 text-chart-3",
    Inactive: "bg-muted text-muted-foreground",
    "New Convert": "bg-accent/10 text-accent",
    "First Timer": "bg-chart-4/10 text-chart-4",
    Visitor: "bg-primary/10 text-primary",
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Banner Slideshow */}
      <DashboardBanner />

      {/* Welcome Banner */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-primary to-primary/70 text-primary-foreground overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          {myMember?.photo_url ? (
            <ImageLightbox src={myMember.photo_url} alt={`${myMember.first_name} ${myMember.last_name}`}>
              <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center text-xl font-bold text-accent-foreground shrink-0 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
                <img src={myMember.photo_url} alt="" className="h-full w-full object-cover" />
              </div>
            </ImageLightbox>
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center text-xl font-bold text-accent-foreground shrink-0 overflow-hidden">
              {myMember ? `${myMember.first_name?.[0]}${myMember.last_name?.[0]}` : currentUser?.full_name?.[0] || "?"}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight">
              Welcome, {myMember?.first_name || currentUser?.full_name || "Member"}!
            </h2>
            <div className="text-primary-foreground/60 text-sm mt-0.5 flex items-center gap-1.5">
              {currentTenant?.name || "My Church"}
              {roleLabel && <Badge className="bg-primary-foreground/20 text-primary-foreground text-[10px] border-0 py-0 px-1.5">{roleLabel}</Badge>}
            </div>
            {myMember && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={`${statusColors[myMember.membership_status] || "bg-primary-foreground/20 text-primary-foreground"} text-xs border-0`}>
                  {myMember.membership_status}
                </Badge>
                {myMember.church_unit && myMember.church_unit !== "None" && (
                  <Badge className="bg-primary-foreground/20 text-primary-foreground/90 text-xs border-0">{myMember.church_unit}</Badge>
                )}
                {myMember.winners_satellite && (
                  <Badge className="bg-accent/30 text-accent text-xs border-0">WSF — {myMember.wsf_centres?.name || "Member"}</Badge>
                )}
              </div>
            )}
          </div>
          <Link to="/my-profile" className="shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-primary-foreground/60 hover:text-primary-foreground transition-colors">
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">My Profile</span>
            </div>
          </Link>
        </CardContent>
      </Card>

      {/* Prompt to complete profile */}
      {!myMember && (
        <Link to="/my-profile">
          <Card className="border border-chart-4/30 bg-chart-4/5 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-chart-4">Complete your member profile</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add your personal details to get the most from the app.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-chart-4 shrink-0" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Birthday Banner */}
      {myMember?.date_of_birth && (() => {
        const dob = new Date(myMember.date_of_birth);
        const today = new Date();
        return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
      })() && (
        <BirthdayBanner firstName={myMember.first_name} />
      )}

      {/* Self Check-In */}
      <SelfCheckInWidget />


      {/* Feed: Announcements + Events tabs */}
      <MemberFeed member={myMember} />

      {/* Growth Milestones (if member profile linked) */}
      {myMember && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Spiritual Development</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GROWTH_FIELDS.map(({ key, label }) => (
                <div key={key} className={`rounded-xl p-3 text-center border ${myMember[key] ? "bg-chart-3/5 border-chart-3/20" : "bg-muted/30 border-border"}`}>
                  {myMember[key]
                    ? <CheckCircle2 className="h-5 w-5 text-chart-3 mx-auto mb-1" />
                    : <XCircle className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1" />}
                  <p className={`text-xs font-medium ${myMember[key] ? "text-chart-3" : "text-muted-foreground"}`}>{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate this app prompt */}
      {!existingFeedback && (
        <Card className="border border-accent/20 bg-accent/5 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFeedbackOpen(true)}>
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <Star className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Enjoying the app?</p>
                <p className="text-xs text-muted-foreground">Tap to rate and share your feedback</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-accent shrink-0" />
          </CardContent>
        </Card>
      )}

      <AppFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}
