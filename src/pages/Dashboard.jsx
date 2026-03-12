import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Users, CalendarDays, UserPlus, HeartHandshake } from "lucide-react";
import StatCard from "@/components/dashboard/StatCard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import GrowthIndices from "@/components/dashboard/GrowthIndices";
import MemberDashboard from "@/components/dashboard/MemberDashboard.jsx";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const isUnitLeader = currentUser?.role === "unit_leader";
  const isLeaderOrAdmin = isAdmin || isUnitLeader;

  // For non-admin users: find their member profile (for unit info)
  const { data: myMemberArr = [] } = useQuery({
    queryKey: ["my-member-profile", currentUser?.email],
    queryFn: () => base44.entities.Member.filter({ email: currentUser.email }),
    enabled: !!currentUser?.email,
  });
  const myMember = myMemberArr[0] || null;
  const myUnits = myMember?.church_units || [];
  const myUnit = myUnits[0] || null; // primary unit is first in array

  // All members (admin only for full list; unit leaders get all to filter client-side)
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["members"],
    queryFn: () => base44.entities.Member.list("-created_date", 500),
    enabled: isLeaderOrAdmin,
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-date", 100),
    enabled: isLeaderOrAdmin,
  });

  const { data: firstTimers = [], isLoading: loadingFirstTimers } = useQuery({
    queryKey: ["firstTimers"],
    queryFn: () => base44.entities.FirstTimer.list("-visit_date", 100),
    enabled: isAdmin, // only admin sees first timers on dashboard
  });

  const { data: followups = [], isLoading: loadingFollowups } = useQuery({
    queryKey: ["followups"],
    queryFn: () => base44.entities.Followup.list("-created_date", 100),
    enabled: isAdmin, // only admin sees all follow-ups on dashboard
  });

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Regular member view
  if (!isLeaderOrAdmin) {
    return <MemberDashboard currentUser={currentUser} myMember={myMember} />;
  }

  const isLoading = loadingMembers || loadingEvents || (isAdmin && (loadingFirstTimers || loadingFollowups));

  // Unit leader: filter stats to their primary unit
  const unitMembers = isUnitLeader && myUnit
    ? members.filter(m => m.church_units && m.church_units.includes(myUnit))
    : members;

  // Unit leaders only see events for their unit (filter by category)
  const unitCategoryMap = {
    "Youth Ministry": "Youth Event",
    "Women's Ministry": "Women's Event",
    "Men's Ministry": "Men's Event",
    "Children's Ministry": "Children's Event",
    "Evangelism": "Outreach",
  };
  const unitEventCategory = isUnitLeader && myUnit ? unitCategoryMap[myUnit] : null;
  const unitEvents = isUnitLeader && unitEventCategory
    ? events.filter(e => e.category === unitEventCategory)
    : events;

  const upcomingEvents = unitEvents.filter(e => e.status === "Upcoming").length;
  const pendingFollowups = isUnitLeader ? 0 : followups.filter(f => f.status === "Pending" || f.status === "In Progress").length;
  const newFirstTimers = isUnitLeader ? 0 : firstTimers.filter(f => f.status === "New").length;

  const activities = [
    ...unitMembers.slice(0, 3).map(m => ({
      type: "member",
      label: `${m.first_name} ${m.last_name} registered`,
      sub: m.membership_status || "Member",
      date: m.created_date,
    })),
    ...unitEvents.slice(0, 3).map(e => ({
      type: "event",
      label: `Event: ${e.title}`,
      sub: `${e.category} — ${e.status}`,
      date: e.date,
    })),
    ...(isAdmin && !isUnitLeader ? firstTimers.slice(0, 3).map(ft => ({
      type: "firsttimer",
      label: `${ft.first_name} ${ft.last_name} visited`,
      sub: ft.status,
      date: ft.visit_date,
    })) : []),
    ...(isAdmin && !isUnitLeader ? followups.slice(0, 3).map(fu => ({
      type: "followup",
      label: `Follow-up: ${fu.person_name}`,
      sub: `${fu.type} — ${fu.status}`,
      date: fu.scheduled_date,
    })) : []),
  ]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 8);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isUnitLeader && myUnit && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700 font-medium">
          Showing dashboard for: <span className="font-bold">{myUnit}</span> unit
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={isUnitLeader ? `${myUnit || "Unit"} Members` : "Total Members"}
          value={unitMembers.length}
          subtitle={isUnitLeader ? "In your unit" : "Active congregation"}
          icon={Users} color="blue"
        />
        <StatCard title="Upcoming Events" value={upcomingEvents} subtitle={isUnitLeader ? `${myUnit} events` : "Scheduled events"} icon={CalendarDays} color="emerald" />
        {isAdmin && !isUnitLeader && <StatCard title="New First Timers" value={newFirstTimers} subtitle="Awaiting follow-up" icon={UserPlus} color="amber" />}
        {isAdmin && !isUnitLeader && <StatCard title="Pending Follow-ups" value={pendingFollowups} subtitle="Requires attention" icon={HeartHandshake} color="violet" />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GrowthIndices members={unitMembers} />
        </div>
        <RecentActivity activities={activities} />
      </div>
    </div>
  );
}