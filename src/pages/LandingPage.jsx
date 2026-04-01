import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Users, CalendarCheck, Calendar, UserCheck, Heart, MessageSquare,
  BarChart3, Bus, GraduationCap, Church, Check, ArrowRight
} from "lucide-react";

const features = [
  { icon: Users, title: "Member Management", desc: "Track membership, profiles, and spiritual growth milestones in one place." },
  { icon: CalendarCheck, title: "Attendance Tracking", desc: "Record and analyse attendance across services, units, and cell groups." },
  { icon: Calendar, title: "Event Management", desc: "Plan events with registration, reminders, and capacity management." },
  { icon: UserCheck, title: "Follow-ups", desc: "Automate follow-up workflows for first-timers and absentees." },
  { icon: Heart, title: "Pastoral Care", desc: "Log counselling sessions, prayer requests, and care assignments." },
  { icon: MessageSquare, title: "Communications", desc: "Send announcements, emails, and SMS to targeted audiences." },
  { icon: BarChart3, title: "Analytics & Reports", desc: "Visualise growth trends, attendance patterns, and engagement metrics." },
  { icon: Bus, title: "Transportation", desc: "Manage transport routes, bookings, and driver assignments." },
  { icon: GraduationCap, title: "Training & Exams", desc: "Run Bible school courses, exams, and issue certificates." },
  { icon: Church, title: "Multi-Church Support", desc: "Manage multiple branches from a single platform with tenant isolation." },
];

const pricingTiers = [
  {
    name: "Free",
    price: "£0",
    period: "/month",
    desc: "For small churches getting started",
    features: ["Up to 50 members", "Basic attendance", "Event management", "Email announcements", "1 admin user"],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "£29",
    period: "/month",
    desc: "For growing congregations",
    features: ["Up to 200 members", "Follow-up automation", "SMS messaging", "Pastoral care logs", "5 admin users", "Basic analytics"],
    cta: "Start Free Trial",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "£59",
    period: "/month",
    desc: "For established churches",
    features: ["Up to 1,000 members", "Advanced analytics", "Training & exams", "Certificate generation", "Transportation module", "Unlimited admins"],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For multi-site organisations",
    features: ["Unlimited members", "Multi-tenant management", "Priority support", "Custom integrations", "Dedicated onboarding", "SLA guarantee"],
    cta: "Contact Us",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/40e09a54-d633-4f1c-bbfc-1ef23b34fa49.png" alt="ChurchConnect logo" className="h-8 w-8 rounded" />
            <span className="font-display text-lg font-bold text-primary">ChurchConnect</span>
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/onboard">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(215 53% 18%) 0%, hsl(215 53% 10%) 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, hsl(42 68% 54% / 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(42 68% 54% / 0.2) 0%, transparent 40%)" }} />
        <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:py-32">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <img src="/lovable-uploads/40e09a54-d633-4f1c-bbfc-1ef23b34fa49.png" alt="" className="h-10 w-10 rounded" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            All-in-One Church<br />
            <span style={{ color: "hsl(42 68% 54%)" }}>Management Platform</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-white/70 sm:text-lg">
            Streamline membership, attendance, events, follow-ups, pastoral care, and communications — everything your church needs to grow and thrive.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto text-base" asChild>
              <Link to="/t/wci-cardiff/auth">
                Get Started Free <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-base border-white/20 text-white hover:bg-white/10 hover:text-white" asChild>
              <Link to="/t/wci-cardiff/auth">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:py-24">
        <div className="text-center">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-4xl">
            Everything Your Church Needs
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            A comprehensive suite of tools designed specifically for church administration and ministry management.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-lg">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-lg font-semibold text-card-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border bg-muted/50 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Start free and scale as your church grows. No hidden fees.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-xl border p-6 transition-shadow hover:shadow-lg ${
                  tier.highlighted
                    ? "border-accent bg-card shadow-md ring-2 ring-accent/30"
                    : "border-border bg-card"
                }`}
              >
                {tier.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
                    Most Popular
                  </span>
                )}
                <h3 className="font-display text-lg font-bold text-card-foreground">{tier.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">{tier.price}</span>
                  <span className="text-sm text-muted-foreground">{tier.period}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{tier.desc}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-card-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                  asChild
                >
                  <Link to="/t/wci-cardiff/auth">{tier.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-4 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/40e09a54-d633-4f1c-bbfc-1ef23b34fa49.png" alt="" className="h-6 w-6 rounded" />
            <span className="font-display text-sm font-bold text-primary">ChurchConnect</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ChurchConnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
