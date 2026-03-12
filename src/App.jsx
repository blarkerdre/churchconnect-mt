import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
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

function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/members" element={<Members />} />
            <Route path="/events" element={<Events />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/followups" element={<Followups />} />
            <Route path="/pastoral-care" element={<PastoralCare />} />
            <Route path="/communications" element={<Communications />} />
            <Route path="/transportation" element={<Transportation />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </Layout>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
