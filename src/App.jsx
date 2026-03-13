import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
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
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import MyProfile from "@/pages/MyProfile";

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

function LeaderRoute({ children }) {
  const { isAdmin, isUnitLeader, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin && !isUnitLeader) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
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
                <Route path="/followups" element={<LeaderRoute><Followups /></LeaderRoute>} />
                <Route path="/pastoral-care" element={<LeaderRoute><PastoralCare /></LeaderRoute>} />
                <Route path="/communications" element={<AdminRoute><Communications /></AdminRoute>} />
                <Route path="/transportation" element={<Transportation />} />
                <Route path="/analytics" element={<LeaderRoute><Analytics /></LeaderRoute>} />
                <Route path="/wsf" element={<AdminRoute><WSFManagement /></AdminRoute>} />
                <Route path="/user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
