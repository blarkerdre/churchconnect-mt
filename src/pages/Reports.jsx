import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart2, ClipboardList, Users, CalendarDays, HeartHandshake, Heart,
  Megaphone, Car, TrendingUp, BookOpen, Globe, MessageSquareHeart, ArrowRight, FileText,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const MODULES = [
  { title: "Analytics", description: "Member milestones, status conversion, attendance & growth.", icon: BarChart2, path: "/analytics" },
  { title: "Members", description: "Member directory, profiles, journeys and exports.", icon: Users, path: "/members" },
  { title: "Church Attendance", description: "Sunday service attendance trends and demographics.", icon: ClipboardList, path: "/church-attendance" },
  { title: "Unit Meeting & Attendance", description: "Unit-level attendance sessions and reports.", icon: ClipboardList, path: "/attendance" },
  { title: "Home Cell", description: "Home Cell (WSF) attendance and centre reports.", icon: Globe, path: "/wsf" },
  { title: "Follow-ups", description: "Follow-ups, sign-posts and referral history.", icon: HeartHandshake, path: "/followups" },
  { title: "Pastoral Care", description: "Care requests, prayer requests and assignments.", icon: Heart, path: "/pastoral-care" },
  { title: "Events", description: "Event registrations and participation reports.", icon: CalendarDays, path: "/events" },
  { title: "Communications", description: "Announcements, SMS, email and message history.", icon: Megaphone, path: "/communications" },
  { title: "Transportation", description: "Ride bookings, assignments and trip reports.", icon: Car, path: "/transportation" },
  { title: "Training Reports", description: "BFC, BCC, LCC and LDC training progress.", icon: TrendingUp, path: "/training-reports" },
  { title: "Unit Tasks", description: "Task assignments, acknowledgements and completion.", icon: ClipboardList, path: "/unit-tasks" },
  { title: "Bible School", description: "Exam sessions, course registrations and results.", icon: BookOpen, path: "/exam-management" },
  { title: "Testimonies", description: "Member testimonies and breakthrough reports.", icon: MessageSquareHeart, path: "/testimony" },
  
];

export default function Reports() {
  const { tenantSlug } = useParams();
  const { isReportsOfficer, isAdmin } = useAuth();
  const prefix = tenantSlug ? `/t/${tenantSlug}` : "";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Reports Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate comprehensive reports across every module of the platform.
            {isReportsOfficer && !isAdmin && " You have read-only access as a Reports Officer."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.path} className="hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-accent/10 text-accent shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">{m.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 mt-auto">
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to={`${prefix}${m.path}`}>
                    Open report <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
