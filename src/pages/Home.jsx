import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Church, Users, CalendarDays, Megaphone, ChevronRight, BookOpen, Heart, Star } from "lucide-react";

export default function Home() {
  const [checking, setChecking] = useState(true);

  // If already logged in, send to dashboard
  useEffect(() => {
    base44.auth.me()
      .then(() => { window.location.href = createPageUrl("Dashboard"); })
      .catch(() => setChecking(false));
  }, []);

  const handleSignIn = () => base44.auth.redirectToLogin(createPageUrl("Dashboard"));

  if (checking) return null;

  const features = [
    { icon: Users, title: "Member Profiles", desc: "Complete member records with personal details, growth milestones and church unit assignments." },
    { icon: CalendarDays, title: "Events & Registration", desc: "Browse and register for upcoming church events, conferences, and special services." },
    { icon: Megaphone, title: "Announcements", desc: "Stay up to date with church news, unit-specific notices and pinned announcements." },
    { icon: Heart, title: "Pastoral Care", desc: "Prayer requests, counselling and pastoral support managed with care and confidentiality." },
    { icon: BookOpen, title: "Growth Tracking", desc: "Track spiritual milestones — baptism, BFC, BCC, LCC, LDC and more." },
    { icon: Star, title: "WSF Centres", desc: "Connect with Winners Satellite Fellowship groups and track attendance." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1f33] via-[#1e3a5f] to-[#0f1f33] flex flex-col">

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#c9a84c] flex items-center justify-center">
            <Church className="h-5 w-5 text-[#0f1f33]" />
          </div>
          <div className="text-white">
            <p className="text-sm font-bold leading-tight">Winners Chapel</p>
            <p className="text-[11px] text-white/50 leading-tight">International Cardiff</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="text-white/70 hover:text-white hover:bg-white/10 hidden sm:inline-flex"
            onClick={() => window.location.href = createPageUrl("Register")}
          >
            Register
          </Button>
          <Button
            className="bg-[#c9a84c] hover:bg-[#b8963e] text-[#0f1f33] font-semibold"
            onClick={() => base44.auth.redirectToLogin(createPageUrl("Dashboard"))}
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 max-w-4xl mx-auto w-full">
        <Badge className="bg-[#c9a84c]/20 text-[#c9a84c] border-[#c9a84c]/30 mb-6 text-xs px-3 py-1">
          Church Management System
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
          Welcome to Winners Chapel<br />
          <span className="text-[#c9a84c]">Cardiff</span>
        </h1>
        <p className="text-white/60 text-lg max-w-xl mb-10">
          Manage your membership, stay connected with church activities, track your spiritual journey and never miss an event.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button
            size="lg"
            className="bg-[#c9a84c] hover:bg-[#b8963e] text-[#0f1f33] font-bold px-10 h-12"
            onClick={() => base44.auth.redirectToLogin(createPageUrl("Dashboard"))}
          >
            Sign In to Your Account
            <ChevronRight className="h-5 w-5 ml-1" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10 px-10 h-12"
            onClick={() => window.location.href = createPageUrl("Register")}
          >
            New Member? Register
          </Button>
        </div>
      </main>

      {/* Features */}
      <section className="px-6 pb-16 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/10 transition-colors">
              <div className="h-9 w-9 rounded-xl bg-[#c9a84c]/20 flex items-center justify-center mb-3">
                <Icon className="h-4 w-4 text-[#c9a84c]" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
              <p className="text-xs text-white/50 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-5 px-6 text-center">
        <p className="text-xs text-white/30">© {new Date().getFullYear()} Winners Chapel International Cardiff. All rights reserved.</p>
      </footer>

    </div>
  );
}