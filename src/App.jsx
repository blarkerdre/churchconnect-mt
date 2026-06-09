import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate, useParams, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import TenantThemeProvider from "@/components/tenants/TenantThemeProvider";
import { useTenant } from "@/contexts/TenantContext";
import LandingPage from "@/pages/LandingPage";

// Lazy — only needed after navigating away from the landing page
const Layout = lazy(() => import("@/components/AppLayout"));
const Auth = lazy(() => import("@/pages/Auth"));

// Lazy-loaded pages — keeps initial bundle small
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Members = lazy(() => import("@/pages/Members"));
const Events = lazy(() => import("@/pages/Events"));
const Attendance = lazy(() => import("@/pages/Attendance"));
const Followups = lazy(() => import("@/pages/Followups"));
const PastoralCare = lazy(() => import("@/pages/PastoralCare"));
const Communications = lazy(() => import("@/pages/Communications"));
const Transportation = lazy(() => import("@/pages/Transportation"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const WSFManagement = lazy(() => import("@/pages/WSFManagement"));
const UserManagement = lazy(() => import("@/pages/UserManagement"));
const SystemLogs = lazy(() => import("@/pages/SystemLogs"));
const TrainingReports = lazy(() => import("@/pages/TrainingReports"));
const ExamManagement = lazy(() => import("@/pages/ExamManagement"));
const ChurchAttendance = lazy(() => import("@/pages/ChurchAttendance"));
const Settings = lazy(() => import("@/pages/Settings"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const MyProfile = lazy(() => import("@/pages/MyProfile"));
const PublicRegistration = lazy(() => import("@/pages/PublicRegistration"));
const PublicWoFBIRegistration = lazy(() => import("@/pages/PublicWoFBIRegistration"));
const Onboard = lazy(() => import("@/pages/Onboard"));
const TenantAdmin = lazy(() => import("@/pages/TenantAdmin"));
const Presentation = lazy(() => import("@/pages/Presentation"));
const SermonNotes = lazy(() => import("@/pages/SermonNotes"));
const Testimony = lazy(() => import("@/pages/Testimony"));
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));
const UnitTasks = lazy(() => import("@/pages/UnitTasks"));
const Reports = lazy(() => import("@/pages/Reports"));
const CertificatesReport = lazy(() => import("@/pages/CertificatesReport"));
const CertificateApprovals = lazy(() => import("@/pages/CertificateApprovals"));

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

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

function ReportsRoute({ children }) {
  const { isAdmin, isReportsOfficer, loading } = useAuth();
  const { tenantSlug } = useParams();
  if (loading) return null;
  if (!isAdmin && !isReportsOfficer) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
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
  const { isAdmin, isWSFLeader, isReportsOfficer, loading } = useAuth();
  const { tenantSlug } = useParams();
  if (loading) return null;
  if (!isAdmin && !isWSFLeader && !isReportsOfficer) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function LeaderRoute({ children }) {
  const { isAdmin, isUnitLeader, isReportsOfficer, loading } = useAuth();
  const { tenantSlug } = useParams();
  if (loading) return null;
  if (!isAdmin && !isUnitLeader && !isReportsOfficer) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function FollowupRoute({ children }) {
  const { isAdmin, isUnitLeader, isReportsOfficer, loading } = useAuth();
  const { tenantSlug } = useParams();
  const { isMemberOfUnit: isFollowupMember, isLoading: memberLoading } = useUnitMembership("Follow-up");
  if (loading || memberLoading) return null;
  if (!isAdmin && !isUnitLeader && !isFollowupMember && !isReportsOfficer) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function TrainingRoute({ children }) {
  const { isAdmin, isUnitLeader, isReportsOfficer, roles, loading } = useAuth();
  const { tenantSlug } = useParams();
  if (loading) return null;
  const isSuperAdmin = roles.includes("super_admin");
  if (!isAdmin && !isSuperAdmin && !isUnitLeader && !isReportsOfficer) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function TrainingReportRoute({ children }) {
  const { isAdmin, isUnitLeader, isReportsOfficer, roles, loading } = useAuth();
  const { tenantSlug } = useParams();
  const { isMemberOfUnit: isTrainingRepMember, isLoading: memberLoading } = useUnitMembership("Training Rep");
  if (loading || memberLoading) return null;
  const isSuperAdmin = roles.includes("super_admin");
  if (!isAdmin && !isSuperAdmin && !isUnitLeader && !isTrainingRepMember && !isReportsOfficer) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function CertificateApprovalsRoute({ children }) {
  const { isAdmin, loading, user } = useAuth();
  const { tenantSlug } = useParams();
  const { tenantId } = useTenant();
  const { data: isTrainingRepLeader = false, isLoading: leaderLoading } = useQuery({
    queryKey: ["is-training-rep-leader", user?.id, tenantId],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_training_rep_leader", { _user_id: user.id, _tenant_id: tenantId });
      return !!data;
    },
  });
  if (loading || leaderLoading) return null;
  if (!isAdmin && !isTrainingRepLeader) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

function FeatureGate({ path, children }) {
  const { roles, loading } = useAuth();
  const { tenantSlug } = useParams();
  const { currentTenant } = useTenant();
  const disabledFeatures = currentTenant?.settings?.disabled_features || [];
  if (loading) return null;
  const isSuperAdmin = roles.includes("super_admin");
  if (!isSuperAdmin && disabledFeatures.includes(path)) return <Navigate to={tenantSlug ? `/t/${tenantSlug}` : "/"} replace />;
  return children;
}

/** Shared set of authenticated app routes — used both at root and under /t/:tenantSlug */
function AppPages() {
  return (
    <Suspense fallback={<PageFallback />}>
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
        <Route path="/analytics" element={<FeatureGate path="/analytics"><ReportsRoute><Analytics /></ReportsRoute></FeatureGate>} />
        <Route path="/training-reports" element={<FeatureGate path="/training-reports"><TrainingReportRoute><TrainingReports /></TrainingReportRoute></FeatureGate>} />
        <Route path="/exam-management" element={<FeatureGate path="/exam-management"><ProtectedRoute><ExamManagement /></ProtectedRoute></FeatureGate>} />
        <Route path="/church-attendance" element={<FeatureGate path="/church-attendance"><TrainingRoute><ChurchAttendance /></TrainingRoute></FeatureGate>} />
        <Route path="/wsf" element={<FeatureGate path="/wsf"><WSFRoute><WSFManagement /></WSFRoute></FeatureGate>} />
        <Route path="/user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="/sermon-notes" element={<FeatureGate path="/sermon-notes"><SermonNotes /></FeatureGate>} />
        <Route path="/testimony" element={<FeatureGate path="/testimony"><Testimony /></FeatureGate>} />
        <Route path="/unit-tasks" element={<ProtectedRoute><UnitTasks /></ProtectedRoute>} />
        <Route path="/reports" element={<ReportsRoute><Reports /></ReportsRoute>} />
        <Route path="/certificates-report" element={<ReportsRoute><CertificatesReport /></ReportsRoute>} />
        <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
        <Route path="/system-logs" element={<AdminRoute><SystemLogs /></AdminRoute>} />
        <Route path="/tenant-admin" element={<SuperAdminRoute><TenantAdmin /></SuperAdminRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function AuthRoutes() {
  return (
    <Routes>
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
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Public landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Bare public routes → redirect to default tenant */}
        <Route path="/register" element={<DefaultTenantRedirect to="register" />} />
        <Route path="/bible-school-register" element={<DefaultTenantRedirect to="bible-school-register" />} />
        <Route path="/auth" element={<AuthProvider><Auth /></AuthProvider>} />

        {/* Tenant-independent public routes */}
        <Route path="/presentation" element={<Presentation />} />
        <Route path="/onboard" element={<Onboard />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />

        {/* Tenant-prefixed public routes */}
        <Route path="/t/:tenantSlug/auth" element={<AuthProvider><Auth /></AuthProvider>} />
        <Route path="/t/:tenantSlug/register" element={<PublicRegistration />} />
        <Route path="/t/:tenantSlug/bible-school-register" element={<PublicWoFBIRegistration />} />

        {/* Public reset-password routes */}
        <Route path="/reset-password" element={<AuthProvider><ResetPassword /></AuthProvider>} />
        <Route path="/t/:tenantSlug/reset-password" element={<AuthProvider><ResetPassword /></AuthProvider>} />

        {/* Authenticated routes — current paths */}
        <Route path="/*" element={<AuthProvider><AuthRoutes /></AuthProvider>} />
      </Routes>
    </Suspense>
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
