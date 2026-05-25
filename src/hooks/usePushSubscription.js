import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantQuery } from "@/hooks/useTenantQuery";

const VAPID_PUBLIC_KEY =
  "BMHyudDLP9eFo0-FhiS-U8tVdJ0oRHKblJ0FILMcwGJkNva6AoPM8bKo5pP6kjg4hWHnoxULBJAw-MPv-1mjhD0";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isPreviewEnv() {
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const h = window.location.hostname;
  return (
    h.includes("id-preview--") ||
    h.includes("lovableproject.com") ||
    h === "localhost" ||
    h === "127.0.0.1"
  );
}

export async function subscribeToPush(userId, tenantId) {
  if (!userId) return null;
  if (isPreviewEnv()) return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;

    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        tenant_id: tenantId || null,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 255),
      },
      { onConflict: "endpoint" },
    );
    return sub;
  } catch (e) {
    console.warn("Push subscription failed:", e);
    return null;
  }
}

export default function usePushSubscription() {
  const { user } = useAuth();
  const { tenantId } = useTenantQuery();

  useEffect(() => {
    if (!user?.id) return;
    // Defer until SW is ready and permission already granted
    subscribeToPush(user.id, tenantId);
  }, [user?.id, tenantId]);
}
