import React, { useState, useEffect } from "react";
import InstallAppDialog, { shouldAutoOpenInstall } from "@/components/pwa/InstallAppDialog";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Download } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import {
  LayoutDashboard, Users, CalendarDays, HeartHandshake,
  Heart, Megaphone, Menu, LogOut,
  ClipboardList, Car, BarChart2, ChevronLeft, Globe, Shield, FileText, TrendingUp, Settings, Mail, AlertTriangle,
  BookOpen, ChevronsUpDown, Check, Lock, MessageSquareHeart, Star, Package
} from "lucide-react";
import AppFeedbackDialog from "@/components/feedback/AppFeedbackDialog";
import SignPostInboxDialog from "@/components/followups/SignPostInboxDialog";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import winnersLogo from "@/assets/winners-chapel-logo.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";
import NotificationBell from "@/components/notifications/NotificationBell";
import PlatformAlertOverlay from "@/components/alerts/PlatformAlertOverlay";
import MobileBottomNav from "@/components/navigation/MobileBottomNav";
import PaymentRequiredScreen from "@/components/tenants/PaymentRequiredScreen";
import PaymentWarningBanner from "@/components/tenants/PaymentWarningBanner";
import useMessageAlerts from "@/hooks/useMessageAlerts";
import PWAUpdateBanner from "@/components/PWAUpdateBanner";
import { getEnvironmentLabel, getBackendHost, isBackendMismatch, isPreviewEnvironment } from "@/lib/environment";
import { useAppSetting } from "@/hooks/useAppSetting";
import { getIconComponent } from "@/lib/icon-map";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Role requirements: null = any authenticated user, "admin" = admin/super_admin, "leader" = admin or unit_leader
const allNavItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/", access: null },
  { name: "My Profile", icon: Users, path: "/my-profile", access: null },
  { name: "Members", icon: Users, path: "/members", access: "leader" },
  { name: "Events", icon: CalendarDays, path: "/events", access: null },
  { name: "Unit Meeting & Attendance", icon: ClipboardList, path: "/attendance", access: "leader" },
  { name: "Follow-ups", icon: HeartHandshake, path: "/followups", access: "followup_member" },
  { name: "Unit Tasks", icon: ClipboardList, path: "/unit-tasks", access: null },
  { name: "Pastoral Care", icon: Heart, path: "/pastoral-care", access: null },
  { name: "Communications", icon: Megaphone, path: "/communications", access: null },
  { name: "Transportation", icon: Car, path: "/transportation", access: null },
  { name: "Children Church", icon: Users, path: "/children-church", access: "children_church" },
  { name: "My Family", icon: Users, path: "/my-family", access: null },
  { name: "Reports Hub", icon: FileText, path: "/reports", access: "reports" },
  { name: "Training Report", icon: TrendingUp, path: "/training-reports", access: "training_report" },
  
  { name: "Church Attendance", icon: ClipboardList, path: "/church-attendance", access: "training" },
  { name: "Bible School", icon: BookOpen, path: "/exam-management", access: null },
  { name: "Sermon Notes", icon: FileText, path: "/sermon-notes", access: null },
  { name: "Testimony", icon: MessageSquareHeart, path: "/testimony", access: null },
  { name: "Home Cell Report", icon: Globe, path: "/wsf", access: "wsf" },
  { name: "User Management", icon: Shield, path: "/user-management", access: "admin" },
  { name: "System Logs", icon: FileText, path: "/system-logs", access: "admin" },
  { name: "Settings", icon: Settings, path: "/settings", access: "admin" },
  { name: "Tenant Admin", icon: Globe, path: "/tenant-admin", access: "super_admin" },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [pendingTenantSwitch, setPendingTenantSwitch] = useState(null);
  const [switchPassword, setSwitchPassword] = useState("");
  const [switchLoading, setSwitchLoading] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signpostInboxOpen, setSignpostInboxOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const { isAvailable: installAvailable, isInstalled, canPrompt, isIOSSafari } = useInstallPrompt();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user, profile, isAdmin, isUnitLeader, isWSFLeader, isReportsOfficer, roles, leaderUnits, isTenantOwner, isTenantAdmin } = useAuth();
  const { currentTenant, tenantId, tenantSlug, tenantMemberships, switchTenant } = useTenant();
  const queryClient = useQueryClient();
  useMessageAlerts();
  const tenantPrefix = tenantSlug ? `/t/${tenantSlug}` : "";
  const isSuperAdmin = roles.includes("super_admin");
  const subscriptionStatus = currentTenant?.subscription_status;
  const { data: externalLinks } = useAppSetting("external_links", []);
  const disabledFeatures = currentTenant?.settings?.disabled_features || [];
  const isFollowupUnit = leaderUnits.includes("Follow-up") || leaderUnits.includes("Follow-Up");
  const isTrainingAccess = isUnitLeader;
  const showSignpostInbox = isUnitLeader || isWSFLeader;

  // Pending signpost count for leaders (drives sidebar badge)
  const { data: signpostPendingCount = 0 } = useQuery({
    queryKey: ["signpost-pending-count", tenantId, user?.id],
    enabled: !!tenantId && !!user?.id && showSignpostInbox,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("followup_referrals")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("assigned_leader_id", user.id)
        .eq("status", "pending");
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 60000,
  });

  // Derive branding from tenant or fall back to defaults
  const tenantName = currentTenant?.name || "Winners Chapel";
  const tenantNameParts = tenantName.split(" ");
  const tenantLine1 = tenantNameParts.length > 2 ? tenantNameParts.slice(0, 2).join(" ") : tenantName;
  const tenantLine2 = tenantNameParts.length > 2 ? tenantNameParts.slice(2).join(" ") : "";
  const tenantLogoUrl = currentTenant?.logo_url || null;
  const { isMemberOfUnit: isFollowupMember } = useUnitMembership("Follow-up");
  const { isMemberOfUnit: isTrainingRepMember } = useUnitMembership("Training Rep");
  const { isMemberOfUnit: isChildrenChurchMember } = useUnitMembership("Children Church");

  // Filter nav items based on role and disabled features
  const navItems = allNavItems.filter(item => {
    // Super admins see all features; others don't see disabled ones
    if (!isSuperAdmin && disabledFeatures.includes(item.path)) return false;
    if (item.access === null) return true;
    if (item.access === "super_admin") return isSuperAdmin;
    if (item.access === "admin") return isAdmin;
    if (item.access === "reports") return isAdmin || isReportsOfficer;
    if (item.access === "leader") return isAdmin || isUnitLeader || isReportsOfficer;
    if (item.access === "wsf") return isAdmin || isWSFLeader || isReportsOfficer;
    if (item.access === "followup_member") return isAdmin || isFollowupUnit || isFollowupMember || isReportsOfficer;
    if (item.access === "training") return isAdmin || isSuperAdmin || isTrainingAccess || isReportsOfficer;
    if (item.access === "training_report") return isAdmin || isSuperAdmin || isUnitLeader || isTrainingRepMember || isReportsOfficer;
    if (item.access === "children_church") return isAdmin || isChildrenChurchMember || (isUnitLeader && (leaderUnits || []).some(u => /children/i.test(u))) || isReportsOfficer;
    return false;
  });

  // Strip tenant prefix from pathname for matching nav items
  const barePath = tenantSlug && location.pathname.startsWith(`/t/${tenantSlug}`)
    ? location.pathname.replace(`/t/${tenantSlug}`, "") || "/"
    : location.pathname;
  const currentNav = navItems.find(n => n.path === barePath) || allNavItems.find(n => n.path === barePath) || navItems[0];

  // Determine role title
  const getRoleTitle = () => {
    if (isSuperAdmin) return "Super Admin";
    if (roles.includes("admin")) return "Admin";
    if (isTenantOwner) return "Tenant Owner";
    if (isTenantAdmin) return "Tenant Admin";
    if (isReportsOfficer) return "Reports Officer";
    if (isUnitLeader && isWSFLeader) return "Unit & Home Cell Leader";
    if (isUnitLeader) return "Unit Leader";
    if (isWSFLeader) return "Home Cell Leader";
    return "Member";
  };

  const handleTenantSwitchRequest = (targetTenantId) => {
    if (targetTenantId === tenantId) {
      setTenantDropdownOpen(false);
      return;
    }
    setPendingTenantSwitch(targetTenantId);
    setSwitchPassword("");
    setTenantDropdownOpen(false);
  };

  const confirmTenantSwitch = async () => {
    if (!switchPassword || !pendingTenantSwitch) return;
    setSwitchLoading(true);
    try {
      const email = user?.email;
      if (!email) throw new Error("No email found");
      const { error } = await supabase.auth.signInWithPassword({ email, password: switchPassword });
      if (error) throw error;
      // Find the target tenant's slug and navigate
      const targetMembership = tenantMemberships.find(m => m.tenant_id === pendingTenantSwitch);
      const targetSlug = targetMembership?.tenants?.slug;
      switchTenant(pendingTenantSwitch);
      queryClient.clear();
      setPendingTenantSwitch(null);
      setSwitchPassword("");
      toast.success("Tenant switched successfully");
      if (targetSlug) {
        navigate(`/t/${targetSlug}`, { replace: true });
      }
    } catch (err) {
      toast.error("Incorrect password. Please try again.");
    } finally {
      setSwitchLoading(false);
    }
  };

  // Auto-open install dialog once per tenant if installable & not dismissed recently
  useEffect(() => {
    if (isInstalled) return;
    if (!user || !tenantId) return;
    if (!canPrompt && !isIOSSafari) return;
    if (!shouldAutoOpenInstall(tenantId)) return;
    const t = setTimeout(() => setInstallOpen(true), 3000);
    return () => clearTimeout(t);
  }, [user, tenantId, canPrompt, isIOSSafari, isInstalled]);

  // Payment gate: suspended tenants are blocked, but only tenant owners/admins
  // see the billing screen — regular members continue to use the app.
  if (subscriptionStatus === "suspended" && !isSuperAdmin && (isTenantAdmin || isTenantOwner)) {
    return <PaymentRequiredScreen />;
  }

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
        {/* Logo & Tenant Switcher */}
        <div className={`border-b border-sidebar-border ${collapsed ? "px-3 py-4" : "p-6 pb-4"}`}>
          <div className="flex items-center gap-3">
            <img src={tenantLogoUrl || winnersLogo} alt={`${tenantName} Logo`} className="h-10 w-10 object-contain shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-display font-bold text-sm leading-tight text-sidebar-foreground">{tenantLine1}</h1>
                {tenantLine2 && <p className="text-[11px] text-sidebar-foreground/50 leading-tight">{tenantLine2}</p>}
              </div>
            )}
          </div>
          {/* Tenant switcher — only show when user has multiple tenants */}
          {tenantMemberships.length > 1 && !collapsed && (
            <div className="mt-3 relative">
              <button
                onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs bg-sidebar-accent/50 hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
              >
                <span className="truncate">{currentTenant?.name || "Select tenant"}</span>
                <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
              </button>
              {tenantDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setTenantDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-lg py-1 max-h-48 overflow-y-auto">
                    {tenantMemberships.map((m) => {
                      const t = m.tenants;
                      const isSelected = tenantId === m.tenant_id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => handleTenantSwitchRequest(m.tenant_id)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-accent transition-colors ${isSelected ? "bg-accent/50 font-medium" : ""}`}
                        >
                          {t?.logo_url && <img src={t.logo_url} alt="" className="h-4 w-4 rounded object-contain shrink-0" />}
                          <span className="truncate flex-1">{t?.name || "Unknown"}</span>
                          {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = barePath === item.path;
            return (
              <Link
                key={item.path}
                to={`${tenantPrefix}${item.path}`}
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

          {/* Sign-Post Inbox (leaders only) */}
          {showSignpostInbox && (
            <button
              onClick={() => { setSignpostInboxOpen(true); setSidebarOpen(false); }}
              title={collapsed ? "Sign-Post Inbox" : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground ${collapsed ? "justify-center" : ""}`}
            >
              <div className="relative shrink-0">
                <Inbox className="h-4 w-4" />
                {signpostPendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-bold flex items-center justify-center">
                    {signpostPendingCount > 9 ? "9+" : signpostPendingCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="flex-1 text-left">Sign-Post Inbox</span>
              )}
            </button>
          )}

          {/* External Links */}
          {externalLinks.length > 0 && (
            <>
              <div className={`border-t border-sidebar-border my-2 ${collapsed ? "mx-2" : "mx-1"}`} />
              {!collapsed && (
                <p className="px-3 text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-1">Links</p>
              )}
              {externalLinks.map((link, idx) => {
                const IconComp = getIconComponent(link.icon);
                return (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={collapsed ? link.title : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground ${collapsed ? "justify-center" : ""}`}
                  >
                    <IconComp className="h-4 w-4 shrink-0" />
                    {!collapsed && link.title}
                  </a>
                );
              })}
            </>
          )}
        </nav>

        {/* User + Sign Out */}
        <div className="flex flex-col p-3 border-t border-sidebar-border gap-2">
          {!collapsed && profile && (
            <div className="px-1">
              <p className="text-xs text-sidebar-foreground/60 truncate">{profile.full_name || profile.email}</p>
              <p className="text-[10px] text-sidebar-foreground/40">{getRoleTitle()}</p>
            </div>
          )}
          {installAvailable && !isInstalled && (
            <button
              onClick={() => { setInstallOpen(true); setSidebarOpen(false); }}
              title={collapsed ? "Install app" : undefined}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors ${collapsed ? "justify-center" : ""}`}
            >
              <Download className="h-4 w-4 shrink-0" />
              {!collapsed && "Install app"}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { setFeedbackOpen(true); setSidebarOpen(false); }}
              title={collapsed ? "Feedback" : undefined}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors ${collapsed ? "justify-center" : ""}`}
            >
              <Star className="h-4 w-4 shrink-0" />
              {!collapsed && "Feedback"}
            </button>
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
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-3 lg:px-8 py-4">
          {isBackendMismatch() && isAdmin && (
            <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Backend mismatch detected — connected to <code className="bg-destructive/10 px-1 rounded">{getBackendHost()}</code></span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-lg font-display font-bold text-foreground leading-tight truncate">
                  {currentNav.name}
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end min-w-0 shrink-0">
              {isAdmin && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isPreviewEnvironment()
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                }`}>
                  {getEnvironmentLabel()}
                </span>
              )}
              {currentTenant && (
                <span className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full hidden sm:flex items-center gap-1 max-w-[140px]">
                  {currentTenant.logo_url && <img src={currentTenant.logo_url} alt="" className="h-3.5 w-3.5 rounded object-contain shrink-0" />}
                  <span className="truncate">{currentTenant.name}</span>
                </span>
              )}
              <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full hidden sm:inline">
                {getRoleTitle()}
              </span>
              <NotificationBell />
              <Button variant="outline" size="icon" className="lg:hidden h-8 w-8 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Mobile-only second row: role + tenant badges */}
          <div className="flex sm:hidden items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {getRoleTitle()}
            </span>
            {currentTenant && (
              <span className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full flex items-center gap-1 max-w-[200px]">
                {currentTenant.logo_url && <img src={currentTenant.logo_url} alt="" className="h-3 w-3 rounded object-contain shrink-0" />}
                <span className="truncate">{currentTenant.name}</span>
              </span>
            )}
          </div>
        </header>

        {subscriptionStatus === "past_due" && !isSuperAdmin && (isTenantAdmin || isTenantOwner) && (
          <PaymentWarningBanner />
        )}
        <PWAUpdateBanner />
        <main className="flex-1 p-3 lg:p-8 pb-20 lg:pb-8">
          {children}
        </main>
        <MobileBottomNav />
      </div>
      <PlatformAlertOverlay />
      {/* Password confirmation dialog for tenant switching */}
      <Dialog open={!!pendingTenantSwitch} onOpenChange={(open) => { if (!open) { setPendingTenantSwitch(null); setSwitchPassword(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Confirm Tenant Switch</DialogTitle>
            <DialogDescription>Enter your password to switch to a different tenant.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); confirmTenantSwitch(); }}>
            <Input
              type="password"
              placeholder="Enter your password"
              value={switchPassword}
              onChange={(e) => setSwitchPassword(e.target.value)}
              autoFocus
              disabled={switchLoading}
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => { setPendingTenantSwitch(null); setSwitchPassword(""); }} disabled={switchLoading}>Cancel</Button>
              <Button type="submit" disabled={!switchPassword || switchLoading}>{switchLoading ? "Verifying..." : "Confirm"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AppFeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <SignPostInboxDialog open={signpostInboxOpen} onOpenChange={setSignpostInboxOpen} />
      <InstallAppDialog open={installOpen} onOpenChange={setInstallOpen} />
    </div>
  );
}
