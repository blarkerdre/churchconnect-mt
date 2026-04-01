import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate, useParams, useLocation } from "react-router-dom";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import TenantThemeProvider from "@/components/tenants/TenantThemeProvider";
import { useAppSetting } from "@/hooks/useAppSetting";
import Layout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Members from "@/pages/Members";
import Events from "@/pages/Events";
import Attendance from "@/pages/Attendance";
import Followups from "@/pages/Followups";
import PastoralCare from "@/pages/PastoralCare";
import Communications from "@/pages/Communications";
import Transportation from "@/pages/Transportation";
import Analytics from "@/pages/Analytics";
import WSFManagement from "@/pages/WSFManagement";
import UserManagement from "@/pages/UserManagement";
import SystemLogs from "@/pages/SystemLogs";
import TrainingReports from "@/pages/TrainingReports";
import ExamManagement from "@/pages/ExamManagement";
import ChurchAttendance from "@/pages/ChurchAttendance";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import MyProfile from "@/pages/MyProfile";
import PublicRegistration from "@/pages/PublicRegistration";
import PublicWoFBIRegistration from "@/pages/PublicWoFBIRegistration";
import Onboard from "@/pages/Onboard";
import TenantAdmin from "@/pages/TenantAdmin";
import Presentation from "@/pages/Presentation";
import Unsubscribe from "@/pages/Unsubscribe";


function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { tenantSlug } = useParams();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  const authPath = tenantSlug ? `/t/${tenantSlug}/auth` : "/auth";
  if (!user) return <Navigate to={authPath} replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  const { tenantSlug } = useParams();
  if (loading) return null;
  if (!isAdmin) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { roles, loading } = useAuth();
  const { tenantSlug } = useParams();
  if (loading) return null;
  if (!roles.includes("super_admin")) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function WSFRoute({ children }) {
  const { isAdmin, isWSFLeader, loading } = useAuth();
  const { tenantSlug } = useParams();
  if (loading) return null;
  if (!isAdmin && !isWSFLeader) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function LeaderRoute({ children }) {
  const { isAdmin, isUnitLeader, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin && !isUnitLeader) return <Navigate to="/" replace />;
  return children;
}

function FollowupRoute({ children }) {
  const { isAdmin, isUnitLeader, loading } = useAuth();
  const { isMemberOfUnit: isFollowupMember, isLoading: memberLoading } = useUnitMembership("Follow-up");
  if (loading || memberLoading) return null;
  if (!isAdmin && !isUnitLeader && !isFollowupMember) return <Navigate to="/" replace />;
  return children;
}

function TrainingRoute({ children }) {
  const { isAdmin, isUnitLeader, roles, loading } = useAuth();
  if (loading) return null;
  const isSuperAdmin = roles.includes("super_admin");
  if (!isAdmin && !isSuperAdmin && !isUnitLeader) return <Navigate to="/" replace />;
  return children;
}

function FeatureGate({ path, children }) {
  const { roles, loading } = useAuth();
  const { data: disabledFeatures } = useAppSetting("disabled_features", []);
  if (loading) return null;
  const isSuperAdmin = roles.includes("super_admin");
  if (!isSuperAdmin && disabledFeatures.includes(path)) return <Navigate to="/" replace />;
  return children;
}

/** Shared set of authenticated app routes — used both at root and under /t/:tenantSlug */
function AppPages() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/my-profile" element={<MyProfile />} />
      <Route path="/members" element={<FeatureGate path="/members"><Members /></FeatureGate>} />
      <Route path="/events" element={<FeatureGate path="/events"><Events /></FeatureGate>} />
      <Route path="/attendance" element={<FeatureGate path="/attendance"><LeaderRoute><Attendance /></LeaderRoute></FeatureGate>} />
      <Route path="/followups" element={<FeatureGate path="/followups"><FollowupRoute><Followups /></FollowupRoute></FeatureGate>} />
      <Route path="/pastoral-care" element={<FeatureGate path="/pastoral-care"><PastoralCare /></FeatureGate>} />
      <Route path="/communications" element={<FeatureGate path="/communications"><Communications /></FeatureGate>} />
      <Route path="/transportation" element={<FeatureGate path="/transportation"><Transportation /></FeatureGate>} />
      <Route path="/analytics" element={<FeatureGate path="/analytics"><AdminRoute><Analytics /></AdminRoute></FeatureGate>} />
      <Route path="/training-reports" element={<FeatureGate path="/training-reports"><TrainingRoute><TrainingReports /></TrainingRoute></FeatureGate>} />
      <Route path="/exam-management" element={<FeatureGate path="/exam-management"><ProtectedRoute><ExamManagement /></ProtectedRoute></FeatureGate>} />
      <Route path="/church-attendance" element={<FeatureGate path="/church-attendance"><TrainingRoute><ChurchAttendance /></TrainingRoute></FeatureGate>} />
      <Route path="/wsf" element={<FeatureGate path="/wsf"><WSFRoute><WSFManagement /></WSFRoute></FeatureGate>} />
      <Route path="/user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
      <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
      <Route path="/system-logs" element={<AdminRoute><SystemLogs /></AdminRoute>} />
      <Route path="/tenant-admin" element={<SuperAdminRoute><TenantAdmin /></SuperAdminRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AuthRoutes() {
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Tenant-prefixed authenticated routes */}
      <Route
        path="/t/:tenantSlug/*"
        element={
          <ProtectedRoute>
            <TenantProvider>
              <TenantThemeProvider>
                <Layout>
                  <AppPages />
                </Layout>
              </TenantThemeProvider>
            </TenantProvider>
          </ProtectedRoute>
        }
      />
      {/* Default authenticated routes (no tenant prefix) */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <TenantProvider>
              <TenantThemeProvider>
                <Layout>
                  <AppPages />
                </Layout>
              </TenantThemeProvider>
            </TenantProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

/** Redirects bare public routes to their default-tenant-prefixed equivalents */
function DefaultTenantRedirect({ to }) {
  const DEFAULT_SLUG = "wci-cardiff";
  return <Navigate to={`/t/${DEFAULT_SLUG}/${to}`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Bare public routes → redirect to default tenant */}
      <Route path="/register" element={<DefaultTenantRedirect to="register" />} />
      <Route path="/wofbi-register" element={<DefaultTenantRedirect to="wofbi-register" />} />
      <Route path="/auth" element={<DefaultTenantRedirect to="auth" />} />

      {/* Tenant-independent public routes */}
      <Route path="/presentation" element={<Presentation />} />
      <Route path="/onboard" element={<Onboard />} />
      <Route path="/unsubscribe" element={<Unsubscribe />} />

      {/* Tenant-prefixed public routes */}
      <Route path="/t/:tenantSlug/auth" element={<AuthProvider><Auth /></AuthProvider>} />
      <Route path="/t/:tenantSlug/register" element={<PublicRegistration />} />
      <Route path="/t/:tenantSlug/wofbi-register" element={<PublicWoFBIRegistration />} />

      {/* Authenticated routes — current paths */}
      <Route path="/*" element={<AuthProvider><AuthRoutes /></AuthProvider>} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AppRoutes />
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
