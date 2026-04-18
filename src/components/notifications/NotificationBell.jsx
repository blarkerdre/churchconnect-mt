import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { useTenant } from "@/contexts/TenantContext";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Trash2, Heart, Megaphone, CalendarDays, Info, ExternalLink, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { requestNotificationPermission, registerServiceWorker, triggerNotificationAlert } from "@/lib/notification-alert";

const typeIcons = {
  pastoral_care: Heart,
  announcement: Megaphone,
  event: CalendarDays,
  general: Info,
};

const referenceTypeIcons = {
  unit_join_request: UserPlus,
};

const typeLabels = {
  pastoral_care: "Pastoral Care",
  announcement: "Announcement",
  event: "Event",
  general: "General",
  followup: "Follow-up",
  transport: "Transport",
  meeting: "Meeting",
  unit_join_request: "Join Request",
};

const referenceRoutes = {
  event: "/events",
  announcement: "/communications",
  followup: "/followups",
  pastoral_care: "/pastoral-care",
  transport: "/transportation",
  meeting: "/wsf",
};

export default function NotificationBell() {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const { tenantSlug } = useTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id, tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!tenantId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    requestNotificationPermission();
    registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!user?.id || !tenantId) return;
    const channel = supabase
      .channel("my-notifications")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.new?.tenant_id === tenantId) {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id, tenantId] });
          triggerNotificationAlert(payload.new.title, payload.new.message);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, tenantId, queryClient]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: async (id) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("tenant_id", tenantId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id, tenantId] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("tenant_id", tenantId).eq("is_read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id, tenantId] }),
  });

  const deleteNotif = useMutation({
    mutationFn: async (id) => {
      await supabase.from("notifications").delete().eq("id", id).eq("tenant_id", tenantId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id, tenantId] }),
  });

  const handleNotificationClick = (n) => {
    if (!n.is_read) markRead.mutate(n.id);
    setSelected(n);
  };

  const handleNavigate = () => {
    if (!selected) return;
    if (selected.tenant_id && selected.tenant_id !== tenantId) {
      toast.error("This notification belongs to a different church.");
      return;
    }
    const refType = selected.reference_type || selected.type;
    let route = referenceRoutes[refType];

    // Join requests: leader-side titles (start with "New Join Request" or "Join Request")
    // route to dashboard widget; member-side approval/decline notifications route to profile.
    if (refType === "unit_join_request") {
      const title = (selected.title || "").toLowerCase();
      if (title.includes("approved") || title.includes("declined")) {
        route = "/my-profile";
      } else {
        route = "/dashboard";
      }
    }

    if (route) {
      const fullRoute = tenantSlug ? `/t/${tenantSlug}${route}` : route;
      setSelected(null);
      setOpen(false);
      navigate(fullRoute);
    }
  };

  const handleDeleteFromDialog = () => {
    if (selected) {
      deleteNotif.mutate(selected.id);
      setSelected(null);
    }
  };

  const selectedRefType = selected?.reference_type || selected?.type;
  const Icon = selected
    ? (referenceTypeIcons[selectedRefType] || typeIcons[selected.type] || Info)
    : Info;
  const selectedLabel = selected
    ? (typeLabels[selectedRefType] || typeLabels[selected.type] || selected.type || "Notification")
    : "Notification";
  const hasRoute = selected && (
    selectedRefType === "unit_join_request"
      ? (!selected.tenant_id || selected.tenant_id === tenantId)
      : (selectedRefType && referenceRoutes[selectedRefType] && (!selected.tenant_id || selected.tenant_id === tenantId))
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5 text-muted-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive flex items-center justify-center text-[9px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllRead.mutate()}>
                <Check className="h-3 w-3 mr-1" /> Mark all read
              </Button>
            )}
          </div>
          <ScrollArea className="max-h-80">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(n => {
                  const NIcon = typeIcons[n.type] || Info;
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 flex gap-3 cursor-pointer hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <NIcon className={`h-4 w-4 mt-0.5 shrink-0 ${!n.is_read ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-tight ${!n.is_read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotif.mutate(n.id); }}
                        className="shrink-0 text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) setSelected(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-5 w-5 text-primary" />
              <Badge variant="secondary" className="text-[10px]">
                {typeLabels[selected?.type] || selected?.type || "Notification"}
              </Badge>
            </div>
            <DialogTitle className="text-base">{selected?.title}</DialogTitle>
            {selected?.created_at && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(selected.created_at), "PPpp")}
              </p>
            )}
          </DialogHeader>

          {selected?.message && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {selected.message}
            </p>
          )}

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleDeleteFromDialog}>
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </div>
            {hasRoute && (
              <Button size="sm" onClick={handleNavigate}>
                <ExternalLink className="h-4 w-4 mr-1" /> View
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
