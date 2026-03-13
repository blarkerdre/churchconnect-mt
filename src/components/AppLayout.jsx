import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, HeartHandshake,
  Heart, Megaphone, Menu, Church, Bell, LogOut,
  ClipboardList, Car, BarChart2, X, ChevronLeft, Globe, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/" },
  { name: "Members", icon: Users, path: "/members" },
  { name: "Events", icon: CalendarDays, path: "/events" },
  { name: "Attendance", icon: ClipboardList, path: "/attendance" },
  { name: "Follow-ups", icon: HeartHandshake, path: "/followups" },
  { name: "Pastoral Care", icon: Heart, path: "/pastoral-care" },
  { name: "Communications", icon: Megaphone, path: "/communications" },
  { name: "Transportation", icon: Car, path: "/transportation" },
  { name: "Analytics", icon: BarChart2, path: "/analytics" },
  { name: "WSF Centres", icon: Globe, path: "/wsf" },
  { name: "User Management", icon: Settings, path: "/user-management" },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const currentNav = navItems.find(n => n.path === location.pathname) || navItems[0];

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

        {/* User + Collapse */}
        <div className="hidden lg:flex flex-col p-3 border-t border-sidebar-border gap-2">
          {!collapsed && profile && (
            <p className="text-xs text-sidebar-foreground/50 truncate px-1">{profile.email}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-2 text-xs text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors flex-1 justify-center"
            >
              <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
              {!collapsed && "Collapse"}
            </button>
            <button
              onClick={signOut}
              title="Sign out"
              className="text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
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
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive flex items-center justify-center text-[9px] font-bold text-destructive-foreground">3</span>
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
