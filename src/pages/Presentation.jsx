import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Maximize, Minimize, Download,
  LayoutDashboard, Users, CalendarDays, UserCheck, Heart,
  Megaphone, Bus, Globe, BarChart3, Shield, CheckCircle2,
  Bell, Mail, MessageSquare, QrCode, ClipboardList, TrendingUp,
  FileText, Lock, Eye, Smartphone, Zap, Church
} from "lucide-react";
import logo from "@/assets/winners-chapel-logo.png";

const SLIDES = [
  // 1 — Title
  {
    bg: "from-[hsl(215,53%,18%)] to-[hsl(215,53%,30%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full text-center gap-6 px-8">
        <img src={logo} alt="Winners Chapel Logo" className="h-28 w-28 rounded-2xl shadow-lg" />
        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          MyChurchConnect
        </h1>
        <p className="text-xl md:text-2xl text-white/70 max-w-2xl">
          A Complete Church Management Platform
        </p>
        <div className="mt-4 px-6 py-2 rounded-full bg-[hsl(42,68%,54%)] text-[hsl(215,53%,12%)] font-semibold text-sm">
          Winners Chapel International Cardiff
        </div>
      </div>
    ),
  },
  // 2 — Overview
  {
    bg: "from-[hsl(215,53%,24%)] to-[hsl(215,40%,35%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-8">
        <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
          Why MyChurchConnect?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
          {[
            { icon: Users, title: "The Challenge", desc: "Churches need a centralised way to manage members, track attendance, coordinate follow-ups, and communicate — all in one place." },
            { icon: Zap, title: "The Solution", desc: "MyChurchConnect brings everything together: member management, event coordination, pastoral care, communications, and analytics in a secure, role-based platform." },
            { icon: Smartphone, title: "Mobile-First", desc: "Fully responsive design that works beautifully on phones, tablets, and desktops. Members can self-check-in and access their profile on the go." },
            { icon: Shield, title: "Secure & Private", desc: "Enterprise-grade security with row-level policies, role-based access control, audit logging, and GDPR compliance built in." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Icon className="h-8 w-8 text-[hsl(42,68%,54%)] mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 3 — Dashboard
  {
    bg: "from-[hsl(215,53%,20%)] to-[hsl(200,40%,28%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Smart Dashboard
          </h2>
        </div>
        <p className="text-white/60 text-lg max-w-2xl text-center">Role-based views that show each user exactly what they need</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full mt-2">
          {[
            { title: "Admin Dashboard", items: ["Total members & growth stats", "Recent activity feed", "Quick action cards", "Growth indices & trends"], color: "hsl(42,68%,54%)" },
            { title: "WSF Leader View", items: ["Centre-specific stats", "Member attendance", "Meeting management", "Centre performance"], color: "hsl(160,50%,50%)" },
            { title: "Member Dashboard", items: ["Personal welcome banner", "Self check-in widget", "Growth milestones", "Announcements feed"], color: "hsl(280,40%,60%)" },
          ].map(({ title, items, color }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="h-3 w-16 rounded-full mb-4" style={{ background: color }} />
              <h3 className="text-lg font-bold text-white mb-3">{title}</h3>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-white/70 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(160,50%,50%)] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 4 — Member Management
  {
    bg: "from-[hsl(200,45%,22%)] to-[hsl(215,53%,28%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <Users className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Member Management
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full mt-2">
          {[
            { icon: ClipboardList, title: "Registration & Profiles", desc: "Complete member profiles with personal details, emergency contacts, and membership status tracking." },
            { icon: QrCode, title: "QR Code Registration", desc: "Generate QR codes for quick public registration. New members can scan and fill their details instantly." },
            { icon: TrendingUp, title: "Growth Milestones", desc: "Track spiritual growth: Water Baptism, Holy Spirit Baptism, BFC, BCC, LCC, LDC completion." },
            { icon: Eye, title: "Status Tracking", desc: "Active, Inactive, New Convert, First Timer — comprehensive membership lifecycle management." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Icon className="h-8 w-8 text-[hsl(42,68%,54%)] mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 5 — Events & Attendance
  {
    bg: "from-[hsl(215,53%,22%)] to-[hsl(240,35%,28%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Events & Attendance
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full mt-2">
          {[
            { title: "Event Creation", desc: "Create events with categories, capacity limits, registration options, and public visibility settings.", icon: CalendarDays },
            { title: "Self Check-In", desc: "Members can check themselves in from their dashboard. Supports manual and QR-based check-in.", icon: Smartphone },
            { title: "Session Tracking", desc: "Sunday Service, Midweek, Special Programs, Unit Meetings — track attendance across all session types.", icon: ClipboardList },
          ].map(({ title, desc, icon: Icon }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-[hsl(42,68%,54%)]/20 flex items-center justify-center mb-4">
                <Icon className="h-8 w-8 text-[hsl(42,68%,54%)]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 6 — Follow-ups
  {
    bg: "from-[hsl(280,30%,22%)] to-[hsl(215,53%,24%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <UserCheck className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Follow-Up System
          </h2>
        </div>
        <p className="text-white/60 text-lg max-w-2xl text-center">Never let a new member fall through the cracks</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
          {[
            { icon: UserCheck, title: "Auto-Assignment", desc: "First timers and new converts are automatically flagged for follow-up with configurable assignment rules." },
            { icon: Bell, title: "Smart Notifications", desc: "Email and SMS notifications sent automatically when follow-ups are assigned or become overdue." },
            { icon: ClipboardList, title: "Status Tracking", desc: "Pending → In Progress → Completed workflow with due dates, priority levels, and detailed notes." },
            { icon: BarChart3, title: "Overdue Alerts", desc: "Dashboard alerts highlight overdue follow-ups so no one gets missed. Leaders see real-time status." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Icon className="h-8 w-8 text-[hsl(42,68%,54%)] mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 7 — Pastoral Care
  {
    bg: "from-[hsl(160,35%,18%)] to-[hsl(215,53%,22%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <Heart className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Pastoral Care
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full mt-2">
          {[
            "Counselling", "Visitation", "Prayer Request", "Hospital Visit",
            "Bereavement", "Marriage", "Financial Support", "Other"
          ].map(type => (
            <div key={type} className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10 flex items-center gap-3">
              <Heart className="h-5 w-5 text-[hsl(42,68%,54%)] shrink-0" />
              <span className="text-white font-medium">{type}</span>
            </div>
          ))}
        </div>
        <div className="bg-white/5 rounded-2xl p-5 max-w-3xl w-full border border-white/10 mt-2">
          <p className="text-white/80 text-sm leading-relaxed text-center">
            Members can submit care requests directly. Cases are assigned to pastoral team members with email & SMS notifications. 
            Full history tracking with confidentiality controls and resolution notes.
          </p>
        </div>
      </div>
    ),
  },
  // 8 — Communications
  {
    bg: "from-[hsl(215,53%,24%)] to-[hsl(42,40%,25%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <Megaphone className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Communications
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full mt-2">
          {[
            { icon: Megaphone, title: "Announcements", desc: "Create and publish announcements with categories, target audiences, publish dates, and expiry dates." },
            { icon: Mail, title: "Email Alerts", desc: "Send bulk email notifications to members with delivery tracking and unsubscribe management." },
            { icon: MessageSquare, title: "SMS Messaging", desc: "Twilio-powered SMS with delivery tracking, message history, invalid number detection, and webhook status updates." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-[hsl(42,68%,54%)]/20 flex items-center justify-center mb-4">
                <Icon className="h-8 w-8 text-[hsl(42,68%,54%)]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 9 — Transportation
  {
    bg: "from-[hsl(215,53%,20%)] to-[hsl(200,50%,25%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <Bus className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Transportation
          </h2>
        </div>
        <p className="text-white/60 text-lg max-w-2xl text-center">Help members get to church with an integrated ride-booking system</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl w-full mt-2">
          {[
            { label: "Request Ride", icon: Smartphone },
            { label: "Assign Driver", icon: UserCheck },
            { label: "Track Status", icon: Eye },
            { label: "Pickup Locations", icon: Globe },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 flex flex-col items-center gap-3 text-center">
              <div className="h-14 w-14 rounded-xl bg-[hsl(42,68%,54%)]/20 flex items-center justify-center">
                <Icon className="h-7 w-7 text-[hsl(42,68%,54%)]" />
              </div>
              <span className="text-white font-semibold text-sm">{label}</span>
            </div>
          ))}
        </div>
        <div className="bg-white/5 rounded-2xl p-5 max-w-3xl w-full border border-white/10">
          <p className="text-white/70 text-sm text-center">
            Pending → Confirmed → Completed workflow • Driver assignment with phone details • Passenger count tracking
          </p>
        </div>
      </div>
    ),
  },
  // 10 — WSF Centres
  {
    bg: "from-[hsl(42,30%,18%)] to-[hsl(215,53%,22%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <Church className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            WSF Centres
          </h2>
        </div>
        <p className="text-white/60 text-lg max-w-2xl text-center">Home Cell Fellowship — extending the church into communities</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full mt-2">
          {[
            { icon: Globe, title: "Centre Management", desc: "Create and manage WSF centres with location, meeting day/time, coverage postcodes, and assigned leaders." },
            { icon: Users, title: "Member Assignment", desc: "Auto-suggest nearest centre based on member postcode. Assign and track WSF membership." },
            { icon: ClipboardList, title: "Attendance Reports", desc: "Record meeting attendance with male/female/children counts, first timers, and testimonies." },
            { icon: BarChart3, title: "Leader Dashboard", desc: "WSF leaders see their centre's performance, members, and attendance history at a glance." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Icon className="h-8 w-8 text-[hsl(42,68%,54%)] mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 11 — Analytics
  {
    bg: "from-[hsl(215,53%,18%)] to-[hsl(280,30%,25%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Analytics & Reports
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full mt-2">
          {[
            { icon: TrendingUp, title: "Attendance Trends", desc: "Visualise attendance patterns across services with interactive charts and date-range filters." },
            { icon: Bell, title: "Absence Alerts", desc: "Automatically identify members who've missed multiple consecutive services for timely follow-up." },
            { icon: Users, title: "Member Consistency", desc: "Score and rank members by attendance consistency to identify engagement levels." },
            { icon: FileText, title: "BFC & Training Report", desc: "Track BFC, BCC, LCC training sessions with attendance breakdowns by gender and milestones." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <Icon className="h-8 w-8 text-[hsl(42,68%,54%)] mb-3" />
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  // 12 — Security & Admin
  {
    bg: "from-[hsl(215,53%,14%)] to-[hsl(215,53%,24%)]",
    content: (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="flex items-center gap-3">
          <Shield className="h-10 w-10 text-[hsl(42,68%,54%)]" />
          <h2 className="text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Security & Administration
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full mt-2">
          {[
            { icon: Lock, title: "Role-Based Access", desc: "Super Admin, Admin, Unit Leader, WSF Leader, Member — granular permissions for every feature." },
            { icon: FileText, title: "Audit Logging", desc: "Every significant action is logged with user ID, timestamp, entity type, and details for full accountability." },
            { icon: Users, title: "User Management", desc: "Create, invite, and manage user accounts. Assign roles and unit leader responsibilities." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-2xl bg-[hsl(42,68%,54%)]/20 flex items-center justify-center mb-4">
                <Icon className="h-8 w-8 text-[hsl(42,68%,54%)]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-[hsl(42,68%,54%)] font-bold text-xl">Built with security-first architecture</p>
          <p className="text-white/50 text-sm">Row-Level Security • JWT Authentication • GDPR Compliance • Encrypted Communications</p>
        </div>
      </div>
    ),
  },
];

export default function Presentation() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const goNext = useCallback(() => setCurrent(c => Math.min(c + 1, SLIDES.length - 1)), []);
  const goPrev = useCallback(() => setCurrent(c => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  const handlePrint = () => window.print();

  const slide = SLIDES[current];

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #presentation-slide, #presentation-slide * { visibility: visible; }
          #presentation-slide { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; }
          #presentation-controls { display: none !important; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        {/* Slide */}
        <div
          id="presentation-slide"
          className={`flex-1 bg-gradient-to-br ${slide.bg} transition-all duration-500 relative overflow-hidden`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x > rect.width / 2) goNext(); else goPrev();
          }}
        >
          {slide.content}
        </div>

        {/* Controls */}
        <div id="presentation-controls" className="bg-black/80 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={goPrev} disabled={current === 0} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors p-1">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <span className="text-white/70 text-sm font-mono min-w-[60px] text-center">
              {current + 1} / {SLIDES.length}
            </span>
            <button onClick={goNext} disabled={current === SLIDES.length - 1} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors p-1">
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>

          {/* Slide dots */}
          <div className="hidden md:flex items-center gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${i === current ? "w-6 bg-[hsl(42,68%,54%)]" : "w-2 bg-white/30 hover:bg-white/50"}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="text-white/60 hover:text-white transition-colors p-1" title="Download as PDF">
              <Download className="h-5 w-5" />
            </button>
            <button onClick={toggleFullscreen} className="text-white/60 hover:text-white transition-colors p-1" title="Toggle fullscreen">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
