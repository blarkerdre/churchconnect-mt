import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, HeartHandshake,
  Heart, Megaphone, Menu, Church, LogOut,
  ClipboardList, Car, BarChart2, ChevronLeft, Globe, Shield, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/notifications/NotificationBell";

// Role requirements: null = any authenticated user, "admin" = admin/super_admin, "leader" = admin or unit_leader
const allNavItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/", access: null },
  { name: "My Profile", icon: Users, path: "/my-profile", access: null },
  { name: "Members", icon: Users, path: "/members", access: "leader" },
  { name: "Events", icon: CalendarDays, path: "/events", access: null },
  { name: "Attendance", icon: ClipboardList, path: "/attendance", access: "leader" },
  { name: "Follow-ups", icon: HeartHandshake, path: "/followups", access: "leader" },
  { name: "Pastoral Care", icon: Heart, path: "/pastoral-care", access: null },
  { name: "Announcements", icon: Megaphone, path: "/communications", access: null },
  { name: "Transportation", icon: Car, path: "/transportation", access: null },
  { name: "Analytics", icon: BarChart2, path: "/analytics", access: "leader" },
  { name: "WSF Centres", icon: Globe, path: "/wsf", access: "wsf" },
  { name: "User Management", icon: Shield, path: "/user-management", access: "admin" },
  { name: "Audit Log", icon: FileText, path: "/audit-log", access: "super_admin" },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { signOut, profile, isAdmin, isUnitLeader, isWSFLeader, roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  // Filter nav items based on role
  const navItems = allNavItems.filter(item => {
    if (item.access === null) return true;
    if (item.access === "super_admin") return isSuperAdmin;
    if (item.access === "admin") return isAdmin;
    if (item.access === "leader") return isAdmin || isUnitLeader;
    if (item.access === "wsf") return isAdmin || isWSFLeader;
    return false;
  });

  const currentNav = navItems.find(n => n.path === location.pathname) || allNavItems.find(n => n.path === location.pathname) || navItems[0];

  // Determine role title
  const getRoleTitle = () => {
    if (isSuperAdmin) return "Super Admin";
    if (isAdmin) return "Admin";
    if (isUnitLeader && isWSFLeader) return "Unit & WSF Leader";
    if (isUnitLeader) return "Unit Leader";
    if (isWSFLeader) return "WSF Leader";
    return "Member";
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen bg-sidebar text-sidebar-foreground z-50 flex flex-col transition-all duration-300 ${
          collapsed ? "w-[72px]" : "w-72"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Logo */}
        <div className={`p-4 border-b border-sidebar-border ${collapsed ? "px-3" : "p-6"}`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sidebar-primary flex items-center justify-center shrink-0">
              <Church className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-display font-bold text-sm leading-tight text-sidebar-foreground">Winners Chapel</h1>
                <p className="text-[11px] text-sidebar-foreground/50 leading-tight">International Cardiff</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.name}
              </Link>
            );
          })}
        </nav>

        {/* User + Sign Out */}
        <div className="flex flex-col p-3 border-t border-sidebar-border gap-2">
          {!collapsed && profile && (
            <div className="px-1">
              <p className="text-xs text-sidebar-foreground/60 truncate">{profile.full_name || profile.email}</p>
              <p className="text-[10px] text-sidebar-foreground/40">{getRoleTitle()}</p>
            </div>
          )}
          <button
            onClick={signOut}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && "Sign Out"}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden lg:flex items-center gap-2 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors justify-center`}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-display font-bold text-foreground">
                {currentNav.name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button variant="outline" size="sm" className="lg:hidden gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={signOut}>
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
