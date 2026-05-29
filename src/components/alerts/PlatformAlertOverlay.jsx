import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { X, Megaphone } from "lucide-react";
import { triggerNotificationAlert } from "@/lib/notification-alert";

const DISMISS_KEY = "platform_alerts_dismissed_v1";

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}
function addDismissed(id) {
  const list = getDismissed();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(list.slice(-200)));
  }
}

export default function PlatformAlertOverlay() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(() => getDismissed());

  const fetchAlerts = useCallback(async () => {
    const { data, error } = await supabase
      .from("platform_alerts")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.warn("[platform-alerts] fetch failed", error);
      return;
    }
    const now = Date.now();
    const visible = (data || []).filter(
      (a) => !a.expires_at || new Date(a.expires_at).getTime() > now
    );
    setAlerts(visible);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchAlerts();
    const channel = supabase
      .channel("platform_alerts_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_alerts" },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new?.active) {
            triggerNotificationAlert(
              payload.new.title || "Platform Alert",
              payload.new.message || ""
            );
          }
          fetchAlerts();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAlerts]);

  const handleDismiss = (id) => {
    addDismissed(id);
    setDismissed((d) => [...d, id]);
  };

  if (!user) return null;
  const active = alerts.filter((a) => !dismissed.includes(a.id));
  if (active.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none flex items-start justify-center pt-20 px-4">
      <div className="flex flex-col gap-3 w-full max-w-md pointer-events-auto">
        {active.map((alert) => (
          <div
            key={alert.id}
            className="relative rounded-2xl border border-primary/30 bg-background/70 backdrop-blur-xl shadow-elegant p-4 pr-10 animate-in slide-in-from-top-4 fade-in"
          >
            <button
              onClick={() => handleDismiss(alert.id)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/60 text-muted-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="shrink-0 h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <Megaphone className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                {alert.title && (
                  <p className="font-semibold text-foreground leading-tight">
                    {alert.title}
                  </p>
                )}
                <p className="text-sm text-foreground/90 whitespace-pre-wrap mt-0.5">
                  {alert.message}
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDismiss(alert.id)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
