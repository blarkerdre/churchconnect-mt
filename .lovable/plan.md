## Push notifications to parents — Teens check-in/out

Notify each guardian in real time when their teen is checked in or out, using the existing `notifications` + `send-push` infrastructure (same path used by pastoral care, follow-ups, etc.).

### Trigger point

Extend the existing `teen_checkin` RPC so that on every successful `checked_in` / `checked_out` / `already_checked_out` action, it inserts a row per guardian into `public.notifications`:

- `user_id` = guardian's `auth.uid` (resolved via `teens.primary_guardian_member_id → members.user_id`; NULL guardians are skipped)
- `tenant_id` = teen's tenant
- `type` = `teen_checkin` (new value)
- `reference_type` = `teen_attendance`
- `reference_id` = `teen_attendance_records.id`
- `title` = e.g. "Ada checked in at Sunday Teens"
- `message` = time + "(late)" flag or duration on check-out
- Manual worker sign-ins are also notified; if the guardian themselves triggered the action, skip the notification (avoid self-notify)

Insertion happens inside the RPC (SECURITY DEFINER) so RLS doesn't block it.

### Push delivery

The existing DB trigger on `public.notifications` fanning to the `send-push` edge function already handles web-push delivery — no changes needed there.

Add one small mapping in `supabase/functions/send-push/index.ts`:

```ts
const referenceRoutes = {
  ...,
  teen_attendance: "/teens-attendance",
};
```

Guardians who don't have push permission still see the in-app bell and toast via the existing `notifications` realtime channel.

### Migration

Single migration:
1. `ALTER TYPE` / extend the `notifications.type` check constraint (if any) to allow `teen_checkin`. (Confirm during implementation — most likely it's a free-form text column.)
2. Replace `public.teen_checkin(...)` with an updated version that, after inserting/updating the attendance record, inserts notification rows for the guardian(s). Reuse the existing return shape so the client code needs no changes.

### Frontend

- No new pages. `NotificationBell` already handles unknown types generically.
- Optional (small): add a friendly icon/label for `teen_checkin` in `NotificationBell` so it shows a Users icon and links to `/teens-attendance` when clicked. Deep-link to the specific session/roster if trivial; otherwise just the page.

### Out of scope

- SMS/email notifications (push + in-app only).
- Configurable per-guardian opt-out (guardians already control push permission at the browser level and can disable notifications in the bell settings).
- Batching / quiet hours.
