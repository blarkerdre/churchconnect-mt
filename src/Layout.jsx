import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  HeartHandshake,
  Heart,
  Megaphone,
  Menu,
  Church,
  Bell,
  LogOut,
  ShieldCheck,
  Home,
  UserCircle,
  HandHeart,
  KeyRound,
  Car,
  BarChart2,
  ClipboardList,
  MessageCircle,
  QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/components/useCurrentUser";
import AccessDenied from "@/components/AccessDenied";
import { useQuery } from "@tanstack/react-query";

// Page access rules: which roles can see each page
// Roles: admin = full access, unit_leader = unit management, user = basic member access
// Nav items - dynamic visibility for unit_leader/user depends on their church_unit (handled in component)
const navItems = [
  { name: "Dashboard",          icon: LayoutDashboard, page: "Dashboard",         roles: ["admin", "unit_leader", "user"] },
  { name: "My Profile",         icon: UserCircle,      page: "MyProfile",         roles: ["user", "unit_leader"] },
  { name: "Pastoral Care",      icon: HandHeart,       page: "MyPastoralCare",    roles: ["user", "unit_leader"] },
  { name: "Members",         icon: Users,           page: "Members",        roles: ["admin", "unit_leader"] },
  { name: "Events",          icon: CalendarDays,    page: "Events",         roles: ["admin", "unit_leader", "user"] },
  { name: "Follow-up",       icon: HeartHandshake,  page: "Followups",      roles: ["admin", "unit_leader"] }, // further filtered by unit below
  { name: "Pastoral Care",   icon: Heart,           page: "PastoralCare",   roles: ["admin"] },
  { name: "WSF",             icon: Home,            page: "WSF",            roles: ["admin", "unit_leader"] }, // unit_leader access filtered by isWSFLeader below
  { name: "Communications",  icon: Megaphone,       page: "Communications", roles: ["admin", "unit_leader", "user"] },
  { name: "Transportation",  icon: Car,             page: "Transportation", roles: ["admin", "unit_leader", "user"] }, // all roles
  { name: "Attendance",     icon: ClipboardList,    page: "Attendance",     roles: ["admin", "unit_leader", "user"] },
  { name: "Analytics",      icon: BarChart2,        page: "Analytics",      roles: ["admin"] },
  { name: "User Management", icon: KeyRound,        page: "UserManagement", roles: ["admin"] },
  { name: "Member QR Code",  icon: QrCode,          page: "MemberQRCode",   roles: ["admin"] },
];

const roleLabels = {
  admin:       { label: "Admin",       color: "bg-rose-100 text-rose-700" },
  unit_leader: { label: "Unit Leader", color: "bg-amber-100 text-amber-700" },
  user:        { label: "Member",      color: "bg-slate-100 text-slate-600" },
};

// Access control summary:
// admin       → full access to all pages
// unit_leader → Members, Events, First Timers, Follow-up, WSF, Communications, My Profile, Dashboard
// user        → Dashboard, My Profile, Events, Communications only

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [seenIds, setSeenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("seen_announcement_ids") || "[]")); }
    catch { return new Set(); }
  });
  const { user, loading, isAdmin, isUnitLeader } = useCurrentUser();

  const role = user?.role || "user";
  const isPublicPage = currentPageName === "Register" || currentPageName === "Home" || currentPageName === "PublicMemberRegistration" || currentPageName === "PrivacyPolicy";

  // Fetch member profile FIRST — needed for unit-based access control
  const { data: myMemberResults = [], isLoading: loadingMyMember } = useQuery({
    queryKey: ["my-member-layout", user?.email],
    queryFn: () => base44.entities.Member.filter({ email: user.email }),
    enabled: !!(user && !isAdmin),
  });
  const myMember = myMemberResults[0] || null;
  const myUnits = myMember?.church_units || [];
  const isFollowupUnit = myUnits.includes("Follow-up");
  const isPastoralCareUnit = myUnits.includes("Pastoral Care");
  // WSF leaders: unit_leaders whose member profile has winners_satellite = true
  const isWSFLeader = isUnitLeader && myMember?.winners_satellite === true;

  // Build allowed nav pages with unit-level filtering
  const allowedPages = navItems.filter(n => {
    if (!n.roles.includes(role)) return false;
    if (isAdmin) return true;
    if (n.page === "WSF") return isWSFLeader;
    if (n.page === "FirstTimers" || n.page === "Followups") return isFollowupUnit;
    if (n.page === "PastoralCare") return isPastoralCareUnit;
    if (n.page === "Transportation") return true; // all members can book transport
    if (n.page === "Analytics") return false;
    return true;
  });

  const currentNavItem = navItems.find(n => n.page === currentPageName);
  // While member profile is loading, don't deny access yet (avoid flash of AccessDenied)
  const hasAccess = (() => {
    if (isPublicPage) return true;
    if (!currentNavItem) return true;
    if (!currentNavItem.roles.includes(role)) return false;
    if (isAdmin) return true;
    if (loadingMyMember) return true; // wait for profile before deciding
    if (currentNavItem.page === "WSF") return isWSFLeader;
    if (currentNavItem.page === "FirstTimers" || currentNavItem.page === "Followups") return isFollowupUnit;
    if (currentNavItem.page === "PastoralCare") return isPastoralCareUnit;
    if (currentNavItem.page === "Transportation") return true; // all members can access transport page
    return true;
  })();

  // Fetch unread announcements as notifications
  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements-notif"],
    queryFn: () => base44.entities.Announcement.list("-created_date", 20),
    enabled: !!user,
  });

  // Fetch pending follow-ups as notifications for leaders/admins
  const { data: pendingFollowups = [] } = useQuery({
    queryKey: ["followups-notif"],
    queryFn: () => base44.entities.Followup.filter({ status: "Pending" }, "-created_date", 10),
    enabled: !!(user && (isAdmin || isUnitLeader)),
  });

  // Fetch unread messages for current user
  const { data: unreadMessages = [] } = useQuery({
    queryKey: ["unread-messages-notif", user?.email],
    queryFn: () => base44.entities.Message.filter({ to_email: user.email, read: false }, "-created_date", 20),
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  // Filter announcements by role: members only see relevant ones
  const relevantAnnouncements = announcements.filter(a => {
    if (isAdmin || isUnitLeader) return true;
    if (a.audience === "Leaders Only") return false;
    if (a.audience === "All Members") return true;
    if (myMember?.church_unit && a.audience === myMember.church_unit) return true;
    return false;
  });

  // Unread = relevant announcements the user hasn't seen yet
  const unreadAnnouncements = relevantAnnouncements.filter(a => !seenIds.has(a.id));

  const notifications = [
    ...unreadAnnouncements.slice(0, 5).map(a => ({
      id: `ann-${a.id}`,
      icon: Megaphone,
      color: "text-blue-500 bg-blue-50",
      title: a.title,
      sub: `Announcement · ${a.audience}`,
      page: null,
    })),
    ...pendingFollowups.slice(0, 5).map(f => ({
      id: `fu-${f.id}`,
      icon: HeartHandshake,
      color: "text-amber-500 bg-amber-50",
      title: `Follow-up: ${f.person_name}`,
      sub: `${f.type} · ${f.priority} priority`,
      page: null,
    })),
    ...unreadMessages.slice(0, 5).map(m => ({
      id: `msg-${m.id}`,
      icon: MessageCircle,
      color: "text-violet-500 bg-violet-50",
      title: `Message from ${m.from_name}`,
      sub: m.body?.slice(0, 60) + (m.body?.length > 60 ? "…" : ""),
      page: "Communications",
    })),
  ];

  // Bell count = unread announcements + pending followups + unread messages
  const notifCount = unreadAnnouncements.length + pendingFollowups.length + unreadMessages.length;

  // Mark all visible announcements as seen when panel is opened
  const handleOpenNotif = () => {
    setNotifOpen(v => !v);
  };

  const markAllSeen = () => {
    const newSeen = new Set([...seenIds, ...relevantAnnouncements.map(a => a.id)]);
    setSeenIds(newSeen);
    localStorage.setItem("seen_announcement_ids", JSON.stringify([...newSeen]));
  };

  // Public pages render without layout wrapper
  if (!loading && !user) return <>{children}</>;
  if (isPublicPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <style>{`
        :root {
          --brand-primary: #1e3a5f;
          --brand-accent: #c9a84c;
          --brand-dark: #0f1f33;
        }
      `}</style>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      {notifOpen && (
        <div className="fixed inset-0 z-40" onClick={() => { setNotifOpen(false); markAllSeen(); }} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-[var(--brand-primary)] text-white z-50 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--brand-accent)] flex items-center justify-center">
              <Church className="h-5 w-5 text-[var(--brand-dark)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-sm leading-tight">Winners Chapel</h1>
              <p className="text-[11px] text-white/50 leading-tight">International Cardiff</p>
            </div>
          </div>
          {user && (
            <div className="mt-4 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 text-white/70" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">{user.full_name || user.email}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${roleLabels[role]?.color || roleLabels.user.color}`}>
                  {roleLabels[role]?.label || "Member"}
                </span>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {allowedPages.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/15 text-[var(--brand-accent)]"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => base44.auth.logout()}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/80 transition-colors w-full"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold text-slate-800">
                {navItems.find((i) => i.page === currentPageName)?.name || currentPageName}
              </h2>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={handleOpenNotif}
              >
                <Bell className="h-5 w-5 text-slate-600" />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center text-[9px] font-bold text-white leading-none">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </Button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Notifications</p>
                    <div className="flex items-center gap-2">
                      {unreadAnnouncements.length > 0 && (
                        <button onClick={markAllSeen} className="text-[11px] text-[#1e3a5f] hover:underline">Mark all read</button>
                      )}
                      {notifCount > 0 && (
                        <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">{notifCount}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">All caught up!</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 ${n.page ? "cursor-pointer" : ""}`}
                          onClick={() => { if (n.page) { setNotifOpen(false); markAllSeen(); window.location.href = createPageUrl(n.page); } }}
                        >
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${n.color}`}>
                            <n.icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-700 leading-tight">{n.title}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{n.sub}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {!loading && !hasAccess ? <AccessDenied /> : children}
        </main>
      </div>
    </div>
  );
}