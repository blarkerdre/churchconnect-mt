import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Lock, Database, Users, Cookie, Trash2, Mail, Bug, Building2 } from "lucide-react";

const sections = [
  {
    icon: Lock,
    title: "Access & authentication",
    body: [
      "Sign-in is handled via email/password and supported social providers, with sessions managed by our backend platform.",
      "Role-based access is enforced server-side. Administrators, tenant owners, leaders, and members each see only the data their role allows.",
      "Every database query is scoped to the signed-in user's tenant; cross-tenant access is blocked by row-level security policies.",
    ],
  },
  {
    icon: Building2,
    title: "Platform & hosting",
    body: [
      "ChurchConnect is built on the Lovable Cloud platform, which provides managed Postgres, authentication, storage, and serverless functions.",
      "Customer data is stored in the United Kingdom (eu-west-2) region to support UK data-residency expectations.",
      "Use of the Lovable platform is a factual description of enabled capabilities and is not a certification or independent audit.",
    ],
  },
  {
    icon: Database,
    title: "Data we collect & how we use it",
    body: [
      "We collect the church membership, attendance, communications, and ministry data that church administrators choose to enter into the app.",
      "Data is used only to operate the features the church has enabled — for example, attendance reporting, follow-ups, pastoral care, and announcements.",
      "We do not sell member data and we do not use it to train third-party AI models.",
    ],
  },
  {
    icon: Users,
    title: "Subprocessors & integrations",
    body: [
      "Email delivery, SMS, WhatsApp, and voice messaging are sent through third-party providers configured by the church administrator.",
      "Each church may also enable optional integrations (e.g. payments, calendar, transport partners). Integrations are only active when explicitly configured.",
      "Church administrators can review the active providers for their tenant inside Settings.",
    ],
  },
  {
    icon: Cookie,
    title: "Cookies & analytics",
    body: [
      "We use first-party cookies and local storage that are strictly required to keep you signed in and to remember your preferences.",
      "We do not run third-party advertising trackers on this app.",
    ],
  },
  {
    icon: Trash2,
    title: "Retention & deletion",
    body: [
      "Tenant administrators can archive or permanently delete their church's data from the Danger Zone in Settings.",
      "When a tenant is deleted, related member, attendance, and communications records are removed from the live database according to the deletion workflow.",
      "Members can request removal of their personal data by contacting their church administrator.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Privacy requests",
    body: [
      "Requests to access, correct, export, or delete personal information should be sent to the church (tenant) that holds the data.",
      "Tenant administrators are responsible for responding to data-subject requests for the members they manage.",
    ],
  },
  {
    icon: Mail,
    title: "Security & incident contact",
    body: [
      "If you believe member data has been exposed or misused, contact your church administrator immediately so they can investigate and notify affected members.",
      "Church administrators can review system activity in System Logs and audit history inside the app.",
    ],
  },
  {
    icon: Bug,
    title: "Vulnerability reporting",
    body: [
      "If you discover a security vulnerability in the app, please report it to your church administrator so it can be triaged and forwarded to the development team.",
      "Please do not publicly disclose suspected vulnerabilities before they have been investigated and fixed.",
    ],
  },
];

export default function Trust() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src="/lovable-uploads/church-connect-logo-transparent.png" alt="ChurchConnect logo" className="h-9 w-9 object-contain" />
            <span className="font-display text-lg font-bold text-primary">ChurchConnect</span>
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </nav>

      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(215 53% 18%) 0%, hsl(215 53% 10%) 100%)" }}>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <ShieldCheck className="h-7 w-7" style={{ color: "hsl(42 68% 54%)" }} />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Trust, Security & Privacy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-white/80 sm:text-base">
            This page is maintained by the ChurchConnect team to answer common security and
            privacy questions about how the platform is operated. It describes app-visible
            controls and is not a Lovable-issued certification or independent audit.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="mb-8 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground sm:p-6">
          <p>
            <span className="font-semibold text-foreground">Shared responsibility.</span>{" "}
            ChurchConnect provides the application and configures the underlying Lovable Cloud
            platform. Each church (tenant) is responsible for its own member data, user
            invitations, role assignments, message content, and legal/regulatory obligations
            that apply to that church. End users are responsible for keeping their sign-in
            credentials private.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="h-full">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="font-display text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {body.map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Last updated {new Date().toLocaleDateString(undefined, { year: "numeric", month: "long" })}.
          This page is editable project content and may be updated as the app evolves. For
          church-specific questions, please contact your church administrator directly.
        </p>
      </section>

      <footer className="border-t border-border bg-card px-4 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/lovable-uploads/church-connect-logo-transparent.png" alt="" className="h-7 w-7 object-contain" />
            <span className="font-display text-sm font-bold text-primary">ChurchConnect</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ChurchConnect. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
