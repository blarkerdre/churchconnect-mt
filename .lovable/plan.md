# Super Admin Broadcast Alerts

Let Super Admins push a live, on-screen overlay alert (transparent background) that appears to every logged-in user — either across all tenants or scoped to one selected tenant.

## 1. Database (migration)

New table `public.platform_alerts`:
- `title` (text, optional)
- `message` (text, required)
- `tenant_id` (uuid, nullable — NULL = broadcast to ALL tenants)
- `created_by` (uuid, auth user id)
- `active` (boolean, default true)
- `expires_at` (timestamptz, nullable)
- standard id/created_at

GRANTs + RLS:
- `SELECT` for `authenticated` where `active = true` AND (`expires_at IS NULL OR expires_at > now()`) AND (`tenant_id IS NULL` OR user has membership in `tenant_id` via `user_has_tenant_access`)
- `INSERT/UPDATE/DELETE` restricted to `has_role(auth.uid(), 'super_admin')`
- Enable Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_alerts`

## 2. Broadcast composer (Super Admin only)

Add a "Broadcast Alert" section in `src/pages/TenantAdmin.jsx` (gated by `roles.includes('super_admin')`):
- Title (optional) + Message (textarea)
- Target: "All tenants" (default) or pick one from a tenant dropdown
- Optional auto-expire (e.g. 5/15/60 min, or no expiry)
- "Send Alert" → inserts row into `platform_alerts`
- List of recent active alerts with a "Deactivate" button (sets `active=false`)

## 3. Global overlay listener

New `src/components/alerts/PlatformAlertOverlay.jsx` mounted in `src/components/AppLayout.jsx` for any authenticated user:
- On mount: query active alerts visible to this user (RLS does the filtering)
- Subscribe via Supabase Realtime to `platform_alerts` INSERT/UPDATE
- Render a fixed, full-viewport overlay with **transparent backdrop** (no dark scrim) — a centered translucent card using existing design tokens (`bg-background/40 backdrop-blur-md border border-border shadow-elegant`), with title, message, and Dismiss button
- Play `triggerNotificationAlert()` from `lib/notification-alert.js` for sound + vibration on new alerts
- Track dismissed alert IDs in `localStorage` so a refresh doesn't re-show the same one; deactivation/expiry hides for everyone

## 4. Out of scope

- No email/SMS/push fan-out (this is purely an on-screen live banner)
- No editing existing announcement system
- No per-user targeting beyond tenant scope

## Technical notes

- Visibility helper: use existing `user_has_tenant_access(uuid, uuid)` if present, else write a SECURITY DEFINER `can_view_platform_alert(alert_row)` to avoid recursive RLS.
- Realtime payload may not respect RLS for all clients; re-check visibility client-side using the user's `tenantMemberships` from `useAuth` before showing.
- Overlay uses `pointer-events-none` on the backdrop wrapper and `pointer-events-auto` on the card so it never blocks the underlying UI outside the card.
