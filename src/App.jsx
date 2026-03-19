import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { useUnitMembership } from "@/hooks/useUnitMembership";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
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
import AuditLog from "@/pages/AuditLog";
import TrainingReports from "@/pages/TrainingReports";
import ChurchAttendance from "@/pages/ChurchAttendance";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import MyProfile from "@/pages/MyProfile";
import PublicRegistration from "@/pages/PublicRegistration";
import Presentation from "@/pages/Presentation";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { roles, loading } = useAuth();
  if (loading) return null;
  if (!roles.includes("super_admin")) return <Navigate to="/" replace />;
  return children;
}

function WSFRoute({ children }) {
  const { isAdmin, isWSFLeader, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin && !isWSFLeader) return <Navigate to="/" replace />;
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

function AuthRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/my-profile" element={<MyProfile />} />
                <Route path="/members" element={<Members />} />
                <Route path="/events" element={<Events />} />
                <Route path="/attendance" element={<LeaderRoute><Attendance /></LeaderRoute>} />
                <Route path="/followups" element={<FollowupRoute><Followups /></FollowupRoute>} />
                <Route path="/pastoral-care" element={<PastoralCare />} />
                <Route path="/communications" element={<Communications />} />
                <Route path="/transportation" element={<Transportation />} />
                <Route path="/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
                <Route path="/training-reports" element={<TrainingRoute><TrainingReports /></TrainingRoute>} />
                <Route path="/church-attendance" element={<TrainingRoute><ChurchAttendance /></TrainingRoute>} />
                <Route path="/wsf" element={<WSFRoute><WSFManagement /></WSFRoute>} />
                <Route path="/user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
                <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
                <Route path="/audit-log" element={<SuperAdminRoute><AuditLog /></SuperAdminRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<PublicRegistration />} />
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
