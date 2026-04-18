
## Plan: Leader approval before joining a Unit or Home Cell

### Behaviour
When a member selects one or more **Church Units** or a **Home Cell Centre** (via `MemberFormDialog`, `MyProfile`, or `PublicRegistration`), the selection is saved as a **pending join request** — not applied to `members.church_unit` / `members.wsf_centre_id` directly. The member only appears in the unit/centre after a **leader OR admin** approves the request. Admins can override (approve/decline anything).

### New table: `unit_join_requests`
```
id uuid pk
tenant_id uuid not null
member_id uuid not null
request_type text check in ('unit','home_cell')
unit_name text          -- when type = 'unit'
wsf_centre_id uuid      -- when type = 'home_cell'
status text default 'pending' check in ('pending','approved','declined','cancelled')
requested_by uuid       -- auth user who submitted (member or admin acting on behalf)
reviewed_by uuid
reviewed_at timestamptz
decline_reason text
created_at, updated_at timestamptz
```
Indexes on `(tenant_id, status)`, `(member_id)`, `(unit_name)`, `(wsf_centre_id)`.
Unique partial index: one **pending** request per `(member_id, request_type, unit_name|wsf_centre_id)`.

**RLS**
- Members can `SELECT/INSERT` their own (via `members.user_id = auth.uid()`); can `UPDATE` only to set `status='cancelled'` on their own pending rows.
- Admins (`is_admin`) can do everything within tenant.
- Unit leaders can `SELECT/UPDATE` rows where `request_type='unit'` and they're assigned to `unit_name` (`is_unit_leader_for_session` pattern).
- Home Cell leaders can `SELECT/UPDATE` rows where `request_type='home_cell'` and they lead that `wsf_centre_id` (via `wsf_centres.leader_id = their member.id`).

### Submission flow (form changes)
In `MemberFormDialog`, `MyProfile` and `PublicRegistration`:
- Compare **selected** units/centre against the member's **currently approved** values.
- For **admins editing in MemberFormDialog** with admin override: keep current behaviour (direct save) — no pending request.
- For everyone else: any *additions* are queued as `pending` requests; *removals* are applied immediately (members can leave on their own). The form shows a yellow info banner: "Your unit/Home Cell change requires leader approval."
- After save, invoke notify edge function for each new request.

### Approval surfaces (both — widget + notification)
1. **Dashboard widget** `PendingJoinRequests.jsx` — shown to:
   - Unit leaders (filtered to their assigned units)
   - Home Cell leaders (filtered to centres where they're `leader_id`)
   - Admins (all pending in tenant)
   Each row: member name + photo, requested unit/centre, requested date, **Approve** / **Decline (with reason)** buttons.
2. **Notification** on submit — new edge function `notify-join-request` (mirrors `notify-unit-leader` pattern: email + SMS + in-app `notifications` row) sent to the assigned leader(s) and tenant admins.
3. **Mobile/sidebar badge** — small count badge on Dashboard nav when leader/admin has pending requests (reuse existing notification bell pattern).

### Approval action
Approving a request runs in a single transaction (DB function `approve_join_request(p_request_id uuid)`):
- Verifies caller is admin OR matching leader.
- Sets `status='approved'`, `reviewed_by`, `reviewed_at`.
- For `unit`: appends `unit_name` to `members.church_unit` (comma-separated, dedup case-insensitive).
- For `home_cell`: sets `members.wsf_centre_id` and `winners_satellite=true`.
- Inserts an `audit_log` row.
- Triggers a notification back to the member ("Your request to join X has been approved").

Decline sets `status='declined'`, stores reason, notifies member.

### Files

**New**
- `supabase/migrations/<ts>_unit_join_requests.sql` — table, RLS, helper functions, `approve_join_request`, `decline_join_request`.
- `supabase/functions/notify-join-request/index.ts` — leader notification (email/SMS/in-app), modelled on `notify-unit-leader`.
- `src/components/dashboard/PendingJoinRequests.jsx` — leader/admin widget.
- `src/hooks/usePendingJoinRequests.jsx` — query + mutation helpers.

**Edit**
- `src/components/members/MemberFormDialog.jsx` — diff selections, queue requests for non-admin saves, banner.
- `src/pages/MyProfile.jsx` — same diff/queue logic on self-edit submit.
- `src/pages/PublicRegistration.jsx` — queue requests after public registration (not auto-join).
- `src/pages/Dashboard.jsx` — render `<PendingJoinRequests />` for admins/leaders.
- `src/components/dashboard/WSFLeaderDashboard.jsx` — show Home-Cell pending requests at the top.
- `src/components/notifications/NotificationBell.jsx` — surface "join request" notification type.

### Security
- All queries `.eq("tenant_id", tenantId)`.
- DB function uses `SECURITY DEFINER` with explicit caller role check.
- Approval audit logged via `logAudit("join_request_approve", ...)`.

### Out of scope (this round)
- Bulk approve/decline UI (single-action only for v1).
- Changing the seed/approval flow for tenant-onboarding admin self-assignment.
