import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";
import { triggerNotificationAlert } from "@/lib/notification-alert";

// Lightweight in-memory cache so we don't spam the members table for every event.
const nameCache = new Map();

async function getDisplayName(userId, tenantId) {
  if (!userId) return "Someone";
  const key = `${tenantId}:${userId}`;
  if (nameCache.has(key)) return nameCache.get(key);
  try {
    const { data } = await supabase
      .from("members")
      .select("first_name,last_name")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const name = data
      ? `${data.first_name || ""} ${data.last_name || ""}`.trim() || "Someone"
      : "Someone";
    nameCache.set(key, name);
    return name;
  } catch {
    return "Someone";
  }
}

function preview(text, max = 120) {
  if (!text) return "";
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Plays the notification chime + browser notification when the current user
 * receives a new direct message or a new announcement in their tenant.
 * Mount once globally (in AppLayout).
 */
export default function useMessageAlerts() {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id || !tenantId) return;

    const messagesChannel = supabase
      .channel(`msg-alerts-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const row = payload.new || {};
          if (row.tenant_id && row.tenant_id !== tenantId) return;
          if (row.sender_id === user.id) return;
          const sender = await getDisplayName(row.sender_id, tenantId);
          triggerNotificationAlert(
            `New message from ${sender}`,
            preview(row.subject ? `${row.subject} — ${row.content}` : row.content)
          );
          queryClient.invalidateQueries({ queryKey: ["messages"] });
        }
      )
      .subscribe();

    const announcementsChannel = supabase
      .channel(`ann-alerts-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "announcements",
          filter: `tenant_id=eq.${tenantId}`,
        },
        async (payload) => {
          const row = payload.new || {};
          if (row.created_by === user.id) return;
          // Don't alert for drafts/scheduled future posts.
          if (row.is_published === false) return;
          if (row.publish_date && new Date(row.publish_date) > new Date()) return;
          const sender = await getDisplayName(row.created_by, tenantId);
          triggerNotificationAlert(
            `New announcement: ${row.title || "Untitled"}`,
            preview(`${row.content || ""}${sender ? ` — ${sender}` : ""}`)
          );
          queryClient.invalidateQueries({ queryKey: ["announcements"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(announcementsChannel);
    };
  }, [user?.id, tenantId, queryClient]);
}
