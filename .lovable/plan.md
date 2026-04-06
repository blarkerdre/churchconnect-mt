

## Fix: PWA Background Notifications via Web Push API

### Problem
The current notification system relies on Supabase Realtime (WebSocket), which only works while the app tab is active. When the PWA is backgrounded or closed on a phone, the WebSocket disconnects and no notifications are delivered. The service worker's `push` listener exists but nothing ever sends Web Push messages to it.

### Root Cause
True PWA background notifications require the **Web Push API** with VAPID keys. The current setup is missing:
1. VAPID key pair (public + private)
2. Client-side push subscription registration
3. Server-side push message delivery when a notification is created

### Solution
Implement the full Web Push flow:

#### 1. Database migration — Store push subscriptions
Create a `push_subscriptions` table to store each user's push subscription per device:
```sql
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  endpoint text NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Users can manage their own subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- Service role can read all (for sending)
```

#### 2. Generate VAPID keys and store as secrets
- Generate a VAPID key pair
- Store `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` as backend secrets
- Expose the public key via a new edge function or hardcode it client-side

#### 3. New edge function: `send-push-notification/index.ts`
- Called by a database trigger when a row is inserted into `notifications`
- Looks up push subscriptions for the target `user_id` + `tenant_id`
- Sends Web Push messages using the `web-push` library (available in Deno)
- Removes stale/expired subscriptions on 410 responses

#### 4. Database trigger — Auto-send push on notification insert
```sql
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := '<supabase_url>/functions/v1/send-push-notification',
    headers := '{"Authorization":"Bearer <service_role>","Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('notification_id', NEW.id, 'user_id', NEW.user_id, 'tenant_id', NEW.tenant_id, 'title', NEW.title, 'message', NEW.message)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION notify_push_on_insert();
```

#### 5. Update `src/lib/notification-alert.js` — Subscribe to push
- After registering the SW, call `swRegistration.pushManager.subscribe()` with the VAPID public key
- Save the subscription to `push_subscriptions` table via Supabase client
- Re-subscribe if subscription changes

#### 6. Update `public/sw.js` — Already handles push events (no change needed)

### Technical Details
- VAPID keys are an asymmetric keypair; the public key is shared with the browser, the private key stays on the server
- `PushManager.subscribe()` returns an endpoint URL + encryption keys that the server uses to send messages
- Push messages are delivered by the browser vendor (Google FCM for Chrome, Mozilla for Firefox, Apple for Safari 16.4+)
- Works even when the PWA is fully closed — the OS wakes the service worker
- Safari on iOS 16.4+ supports Web Push for installed PWAs

### Files changed
- **Database migration** — `push_subscriptions` table + trigger on `notifications`
- **New**: `supabase/functions/send-push-notification/index.ts`
- **Secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (email)
- `src/lib/notification-alert.js` — push subscription logic
- `public/sw.js` — no changes needed (already handles push)

