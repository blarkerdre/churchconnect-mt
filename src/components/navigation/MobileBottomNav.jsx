import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Heart, Car, UserCircle } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

const tabs = [
  { name: "Home", icon: LayoutDashboard, path: "/" },
  { name: "Events", icon: CalendarDays, path: "/events" },
  { name: "Care", icon: Heart, path: "/pastoral-care" },
  { name: "Transport", icon: Car, path: "/transportation" },
  { name: "Profile", icon: UserCircle, path: "/my-profile" },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const { tenantSlug } = useTenant();
  const tenantPrefix = tenantSlug ? `/t/${tenantSlug}` : "";
  const barePath = tenantSlug && pathname.startsWith(`/t/${tenantSlug}`)
    ? pathname.replace(`/t/${tenantSlug}`, "") || "/"
    : pathname;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border lg:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ name, icon: Icon, path }) => {
          const active = barePath === path;
          return (
            <Link
              key={path}
              to={`${tenantPrefix}${path}`}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
