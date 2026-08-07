import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Maximize, Minimize, Download,
  LayoutDashboard, Users, CalendarDays, UserCheck, Heart,
  Megaphone, Bus, Globe, BarChart3, Shield, CheckCircle2,
  Bell, Mail, MessageSquare, QrCode, ClipboardList, TrendingUp,
  FileText, Lock, Eye, Smartphone, Zap, Church, GraduationCap,
  Baby, KeyRound, Award, Sparkles
} from "lucide-react";

const LOGO = "/lovable-uploads/church-connect-logo-transparent.png";
const GOLD = "hsl(42,68%,54%)";
const FOOTER = "Powered by DomiFort Solutions Limited";

/** Shared slide wrapper: scrollable, responsive padding, consistent header + footer. */
function SlideShell({ icon: Icon, title, subtitle, children, center = false }) {
  return (
    <div className="h-full w-full overflow-y-auto overscroll-contain">
      <div className={`min-h-full flex flex-col ${center ? "justify-center" : ""} items-center gap-4 sm:gap-6 px-4 py-6 sm:px-8 sm:py-10`}>
        {(Icon || title) && (
          <div className="flex items-center gap-2 sm:gap-3 text-center">
            {Icon ? <Icon className="h-6 w-6 sm:h-9 sm:w-9 shrink-0" style={{ color: GOLD }} /> : null}
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              {title}
            </h2>
          </div>
        )}
        {subtitle ? (
          <p className="text-white/60 text-sm sm:text-lg max-w-2xl text-center">{subtitle}</p>
        ) : null}
        <div className="w-full flex-1 flex flex-col items-center justify-center">
          {children}
        </div>
        <p className="text-white/35 text-[10px] sm:text-xs tracking-wide pt-2">{FOOTER}</p>
      </div>
    </div>
  );
}

const CARD = "bg-white/10 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-white/10";

function FeatureGrid({ items, cols = 2, centerText = false }) {
  const colClass = cols === 3
    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    : cols === 4
      ? "grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2";
  return (
    <div className={`grid ${colClass} gap-3 sm:gap-5 max-w-5xl w-full`}>
      {items.map(({ icon: Icon, title, desc }) => (
        <div key={title} className={`${CARD} ${centerText ? "flex flex-col items-center text-center" : ""}`}>
          {Icon ? <Icon className="h-6 w-6 sm:h-8 sm:w-8 mb-2 sm:mb-3" style={{ color: GOLD }} /> : null}
          <h3 className="text-base sm:text-lg font-bold text-white mb-1 sm:mb-2">{title}</h3>
          <p className="text-white/70 text-xs sm:text-sm leading-relaxed">{desc}</p>
        </div>
      ))}
    </div>
  );
}

const SLIDES = [
  // 1 — Title
  {
    bg: "from-[hsl(215,53%,18%)] to-[hsl(215,53%,30%)]",
    content: (
      <SlideShell center>
        <div className="flex flex-col items-center justify-center text-center gap-4 sm:gap-6">
          <img src={LOGO} alt="ChurchConnect logo" className="h-20 w-20 sm:h-28 sm:w-28 object-contain drop-shadow-lg" />
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            ChurchConnect
          </h1>
          <p className="text-base sm:text-xl md:text-2xl text-white/70 max-w-2xl">
            A Complete Church Management Platform
          </p>
          <div className="mt-2 px-5 py-2 rounded-full font-semibold text-xs sm:text-sm" style={{ background: GOLD, color: "hsl(215,53%,12%)" }}>
            Demo Church
          </div>
        </div>
      </SlideShell>
    ),
  },
  // 2 — Overview
  {
    bg: "from-[hsl(215,53%,24%)] to-[hsl(215,40%,35%)]",
    content: (
      <SlideShell title="Why ChurchConnect?">
        <FeatureGrid items={[
          { icon: Users, title: "The Challenge", desc: "Churches need one place to manage members, attendance, follow-ups, training and communication." },
          { icon: Zap, title: "The Solution", desc: "Members, events, pastoral care, Bible School, children's ministry, communications and analytics in a single secure platform." },
          { icon: Smartphone, title: "Mobile-First & Installable", desc: "Responsive across phone, tablet and desktop, installable as a PWA with push notifications." },
          { icon: Shield, title: "Secure & Multi-Tenant", desc: "Row-level security, role-based access, audit logging, 2FA and GDPR compliance built in." },
        ]} />
      </SlideShell>
    ),
  },
  // 3 — Dashboards
  {
    bg: "from-[hsl(215,53%,20%)] to-[hsl(200,40%,28%)]",
    content: (
      <SlideShell icon={LayoutDashboard} title="Smart Dashboards" subtitle="Role-based views that show each user exactly what they need">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 max-w-5xl w-full">
          {[
            { title: "Admin", items: ["Membership & growth stats", "Activity feed & alerts", "Quick actions", "Trends and indices"], color: GOLD },
            { title: "Unit / Home Cell Leader", items: ["Unit-scoped records", "Meetings & attendance", "Task assignments", "Centre performance"], color: "hsl(160,50%,50%)" },
            { title: "Member", items: ["Welcome banner & slideshow", "Self check-in widget", "Birthday celebrants", "Announcements feed"], color: "hsl(280,40%,60%)" },
          ].map(({ title, items, color }) => (
            <div key={title} className={CARD}>
              <div className="h-2.5 w-14 rounded-full mb-3" style={{ background: color }} />
              <h3 className="text-base sm:text-lg font-bold text-white mb-2">{title}</h3>
              <ul className="space-y-1.5">
                {items.map(item => (
                  <li key={item} className="flex items-start gap-2 text-white/70 text-xs sm:text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "hsl(160,50%,50%)" }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SlideShell>
    ),
  },
  // 4 — Member Management
  {
    bg: "from-[hsl(200,45%,22%)] to-[hsl(215,53%,28%)]",
    content: (
      <SlideShell icon={Users} title="Member Management">
        <FeatureGrid items={[
          { icon: ClipboardList, title: "Profiles & Family", desc: "Full member profiles, occupation and nationality, emergency contacts and linked family members." },
          { icon: QrCode, title: "QR Registration", desc: "Public registration links and QR codes so new members can self-register in seconds." },
          { icon: TrendingUp, title: "Growth Milestones", desc: "Water Baptism, Holy Spirit Baptism, BFC, BCC, LCC and LDC progress at a glance." },
          { icon: Eye, title: "Status Lifecycle", desc: "First Timer, New Convert, Visitor, Active and Inactive — with conversion reporting." },
        ]} />
      </SlideShell>
    ),
  },
  // 5 — Events & Attendance
  {
    bg: "from-[hsl(215,53%,22%)] to-[hsl(240,35%,28%)]",
    content: (
      <SlideShell icon={CalendarDays} title="Events & Attendance">
        <FeatureGrid cols={3} centerText items={[
          { icon: CalendarDays, title: "Events", desc: "Categories, capacity, registration, reminders and public or audience-scoped visibility." },
          { icon: Smartphone, title: "Self Check-In", desc: "Members check in from their dashboard, or scan a persistent QR code on arrival." },
          { icon: FileText, title: "Rosters & Audit", desc: "Downloadable CSV and branded PDF rosters, with a full audit trail of every change." },
        ]} />
      </SlideShell>
    ),
  },
  // 6 — Follow-ups
  {
    bg: "from-[hsl(280,30%,22%)] to-[hsl(215,53%,24%)]",
    content: (
      <SlideShell icon={UserCheck} title="Follow-Ups & Sign-Posting" subtitle="Never let a new member fall through the cracks">
        <FeatureGrid items={[
          { icon: UserCheck, title: "Auto-Assignment", desc: "First timers and new converts are flagged automatically with configurable assignment rules." },
          { icon: Bell, title: "Smart Notifications", desc: "In-app, email and SMS alerts when follow-ups are assigned or become overdue." },
          { icon: MessageSquare, title: "Sign-Posting", desc: "Refer a member to another team, track the referral timeline and close the loop with updates." },
          { icon: BarChart3, title: "Overdue Reporting", desc: "Dashboards and printable reports keep leaders on top of pending care." },
        ]} />
      </SlideShell>
    ),
  },
  // 7 — Pastoral Care
  {
    bg: "from-[hsl(160,35%,18%)] to-[hsl(215,53%,22%)]",
    content: (
      <SlideShell icon={Heart} title="Pastoral Care">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 max-w-4xl w-full">
          {["Counselling", "Visitation", "Prayer Request", "Hospital Visit", "Bereavement", "Marriage", "Testimony", "Life Events"].map(type => (
            <div key={type} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-3 sm:px-5 sm:py-4 border border-white/10 flex items-center gap-2">
              <Heart className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
              <span className="text-white font-medium text-xs sm:text-base">{type}</span>
            </div>
          ))}
        </div>
        <div className="bg-white/5 rounded-2xl p-4 sm:p-5 max-w-3xl w-full border border-white/10 mt-4">
          <p className="text-white/80 text-xs sm:text-sm leading-relaxed text-center">
            Members submit care requests directly. Cases are assigned to the pastoral team with notifications,
            confidentiality controls, full history and resolution notes.
          </p>
        </div>
      </SlideShell>
    ),
  },
  // 8 — Communications
  {
    bg: "from-[hsl(215,53%,24%)] to-[hsl(42,40%,25%)]",
    content: (
      <SlideShell icon={Megaphone} title="Communications">
        <FeatureGrid cols={2} items={[
          { icon: Megaphone, title: "Announcements", desc: "Targeted audiences, publish and expiry dates, reactions and read tracking." },
          { icon: Mail, title: "Email", desc: "Branded transactional and bulk email with delivery tracking and unsubscribe management." },
          { icon: MessageSquare, title: "SMS & WhatsApp", desc: "Multi-provider messaging with quotas, delivery status and invalid-number detection." },
          { icon: Bell, title: "In-App & Push", desc: "Real-time notification bell plus installable push notifications on mobile devices." },
        ]} />
      </SlideShell>
    ),
  },
  // 9 — Bible School
  {
    bg: "from-[hsl(215,53%,18%)] to-[hsl(160,35%,24%)]",
    content: (
      <SlideShell icon={GraduationCap} title="Bible School" subtitle="End-to-end training administration, session by session">
        <FeatureGrid cols={3} items={[
          { icon: ClipboardList, title: "Applications & Registration", desc: "Public or member applications, approval workflow and automated student-number emails." },
          { icon: CalendarDays, title: "Sessions & Editions", desc: "Open and close editions; every tab, report and export follows the selected session." },
          { icon: QrCode, title: "Attendance", desc: "Persistent QR check-in and check-out, punctuality tracking and downloadable rosters." },
          { icon: FileText, title: "Exams & Results", desc: "Question banks per subject, secure exam links, automated grading and classifications." },
          { icon: CheckCircle2, title: "Quality Control", desc: "Training Rep QC checklists per lecturer and subject, plus lecturer and course feedback." },
          { icon: Award, title: "Certificates & Reports", desc: "Statement of result, branded certificates and an editable final course report." },
        ]} />
      </SlideShell>
    ),
  },
  // 10 — Children & Teens
  {
    bg: "from-[hsl(200,45%,20%)] to-[hsl(280,30%,26%)]",
    content: (
      <SlideShell icon={Baby} title="Children & Teens Church" subtitle="Safeguarding-first check-in for every age group">
        <FeatureGrid cols={2} items={[
          { icon: QrCode, title: "QR Check-In / Out", desc: "One persistent QR code per ministry; the link only works while a session is open." },
          { icon: KeyRound, title: "Secure Pickup", desc: "PIN-based pickup, authorised adults, delegation codes and leader override." },
          { icon: Shield, title: "Parental Consent", desc: "Attendance requires explicit parental consent, managed from My Family." },
          { icon: Bell, title: "Parent Notifications", desc: "In-app notifications to parents the moment a child or teen checks in or out." },
        ]} />
      </SlideShell>
    ),
  },
  // 11 — Home Cell
  {
    bg: "from-[hsl(42,30%,18%)] to-[hsl(215,53%,22%)]",
    content: (
      <SlideShell icon={Church} title="Home Cell Centres" subtitle="Extending the church into communities">
        <FeatureGrid items={[
          { icon: Globe, title: "Centre Management", desc: "Locations, meeting day and time, coverage postcodes and assigned leaders." },
          { icon: Users, title: "Member Assignment", desc: "Suggest the nearest centre by postcode and track centre membership." },
          { icon: ClipboardList, title: "Attendance Reports", desc: "Demographic counts, first timers and testimonies captured per meeting." },
          { icon: BarChart3, title: "Leader Dashboard", desc: "Centre performance, members and attendance history at a glance." },
        ]} />
      </SlideShell>
    ),
  },
  // 12 — Transportation
  {
    bg: "from-[hsl(215,53%,20%)] to-[hsl(200,50%,25%)]",
    content: (
      <SlideShell icon={Bus} title="Transportation" subtitle="Integrated ride booking so nobody misses a service">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-4xl w-full">
          {[
            { label: "Request Ride", icon: Smartphone },
            { label: "Assign Driver", icon: UserCheck },
            { label: "Track Status", icon: Eye },
            { label: "Pickup Points", icon: Globe },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className={`${CARD} flex flex-col items-center gap-2 text-center`}>
              <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center" style={{ background: "hsl(42,68%,54%,0.2)" }}>
                <Icon className="h-5 w-5 sm:h-7 sm:w-7" style={{ color: GOLD }} />
              </div>
              <span className="text-white font-semibold text-xs sm:text-sm">{label}</span>
            </div>
          ))}
        </div>
        <div className="bg-white/5 rounded-2xl p-4 max-w-3xl w-full border border-white/10 mt-4">
          <p className="text-white/70 text-xs sm:text-sm text-center">
            Pending to Confirmed to Completed workflow • Driver availability and route planning • Passenger tracking and reports
          </p>
        </div>
      </SlideShell>
    ),
  },
  // 13 — Analytics
  {
    bg: "from-[hsl(215,53%,18%)] to-[hsl(280,30%,25%)]",
    content: (
      <SlideShell icon={BarChart3} title="Analytics & Reports">
        <FeatureGrid items={[
          { icon: TrendingUp, title: "Attendance Trends", desc: "Interactive charts with demographic breakdowns and date-range filters." },
          { icon: Bell, title: "Absence Alerts", desc: "Spot members who have missed consecutive services and act quickly." },
          { icon: Users, title: "Milestone & Conversion", desc: "Milestone-gap reports and First Timer to Active conversion tracking with one-click messaging." },
          { icon: FileText, title: "Reports Hub", desc: "A read-only Reports Officer role with cross-module reporting and exports." },
        ]} />
      </SlideShell>
    ),
  },
  // 14 — Security
  {
    bg: "from-[hsl(215,53%,14%)] to-[hsl(215,53%,24%)]",
    content: (
      <SlideShell icon={Shield} title="Security & Administration">
        <FeatureGrid cols={3} centerText items={[
          { icon: Lock, title: "Role-Based Access", desc: "Super Admin, Admin, Unit Leader, Home Cell Leader, Reports Officer and Member permissions." },
          { icon: KeyRound, title: "Two-Factor Auth", desc: "TOTP enforced at sign-in, with administrator-assisted reset when a device is lost." },
          { icon: FileText, title: "Audit Logging", desc: "Every significant action logged with user, timestamp and field-level changes." },
        ]} />
        <div className="mt-4 flex flex-col items-center gap-1.5 text-center">
          <p className="font-bold text-base sm:text-xl" style={{ color: GOLD }}>Built with a security-first architecture</p>
          <p className="text-white/50 text-[11px] sm:text-sm">Row-Level Security • Multi-Tenant Isolation • UK Data Residency • GDPR Compliance</p>
        </div>
      </SlideShell>
    ),
  },
  // 15 — Closing
  {
    bg: "from-[hsl(215,53%,16%)] to-[hsl(42,40%,24%)]",
    content: (
      <SlideShell center>
        <div className="flex flex-col items-center justify-center text-center gap-4 sm:gap-6">
          <img src={LOGO} alt="ChurchConnect logo" className="h-16 w-16 sm:h-24 sm:w-24 object-contain" />
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Thank You
          </h2>
          <p className="text-white/70 text-sm sm:text-lg max-w-xl">
            ChurchConnect — one secure platform for people, ministry and growth.
          </p>
          <div className="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-xs sm:text-sm" style={{ background: GOLD, color: "hsl(215,53%,12%)" }}>
            <Sparkles className="h-4 w-4" />
            Powered by DomiFort Solutions Limited
          </div>
          <p className="text-white/45 text-xs sm:text-sm">Demo Church</p>
        </div>
      </SlideShell>
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
          className={`flex-1 min-h-0 bg-gradient-to-br ${slide.bg} transition-all duration-500 relative overflow-hidden`}
          onClick={(e) => {
            // Tap-to-advance only on wider screens so mobile scrolling isn't hijacked
            if (window.innerWidth < 768) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x > rect.width / 2) goNext(); else goPrev();
          }}
        >
          {slide.content}
        </div>

        {/* Controls */}
        <div id="presentation-controls" className="bg-black/80 backdrop-blur-sm px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={goPrev} disabled={current === 0} className="text-white/60 hover:text-white disabled:opacity-30 transition-colors p-1">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <span className="text-white/70 text-xs sm:text-sm font-mono min-w-[54px] text-center">
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
                className={`h-2 rounded-full transition-all ${i === current ? "w-6" : "w-2 bg-white/30 hover:bg-white/50"}`}
                style={i === current ? { background: GOLD } : undefined}
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
