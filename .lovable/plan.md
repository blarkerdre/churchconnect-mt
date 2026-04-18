
The user approved the two follow-ups: (1) route public registration through approval, and (2) surface join-request notifications in the bell with deep links.

## Plan: Finish join-request approval flow

### 1. Public registration → pending instead of auto-join
Currently `public-register` (and `PublicRegistration.jsx`) writes the selected `church_unit` and `wsf_centre_id` straight onto the new `members` row. Change to: insert the member with **no** unit/centre, then create `unit_join_requests` rows for each requested unit + centre and notify leaders.

**Edit** `supabase/functions/public-register/index.ts`:
- Strip `church_unit` and `wsf_centre_id` (and `winners_satellite`) from the initial member INSERT.
- After insert, for each comma-split unit name → insert into `unit_join_requests` (`request_type='unit'`, `requested_by=null`).
- If a centre was selected → insert one row (`request_type='home_cell'`).
- Fire `notify-join-request` per inserted row (best-effort).
- Keep tenant scoping + existing welcome email flow intact.

**Edit** `src/pages/PublicRegistration.jsx`:
- Add a small info banner under the unit/centre fields: "Your selection will be sent to the leader for approval after registration."
- Keep success screen as-is (member is registered; only their unit/centre is pending).

### 2. NotificationBell — surface join requests with deep link
**Edit** `src/components/notifications/NotificationBell.jsx`:
- Add `unit_join_request` to `typeLabels` → "Join Request".
- Add icon mapping (`UserPlus` from lucide-react) for `unit_join_request` reference type.
- Add route mapping: when `reference_type === 'unit_join_request'`, deep-link to `/dashboard` (where `PendingJoinRequests` widget lives) for leaders/admins, and to `/my-profile` for the member receiving approve/decline notifications.
  - Simple heuristic: if title starts with "Join Request" → leader-side → `/dashboard`; otherwise (title contains "Approved"/"Declined") → `/my-profile`.

### 3. (Small polish) `notify-join-request` — link in email
The edge function already exists; verify the email body's CTA points at `/dashboard` (tenant-prefixed). If it currently uses a placeholder, update to use the tenant slug from the request payload.

### Files
- **Edit**: `supabase/functions/public-register/index.ts`
- **Edit**: `src/pages/PublicRegistration.jsx`
- **Edit**: `src/components/notifications/NotificationBell.jsx`
- **Verify/Edit**: `supabase/functions/notify-join-request/index.ts` (CTA link only)

### Out of scope
- Email/SMS templates redesign — only CTA URL touched if needed.
- Bulk approve/decline (still v2).
