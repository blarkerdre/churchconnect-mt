## Why Silver missed the PIN

Three independent gaps stack up:

1. The in-app notification insert is blocked by RLS for Children's Church workers who aren't `admin`/`unit_leader` (Romoke is `wsf_leader`, so the insert is silently rejected).
2. Email/SMS delivery is gated on "walk-in only" (no `user_id`), so parents with accounts never get the PIN by email or SMS.
3. The check-in code swallows the notification error with a `console.warn`, so no one sees the failure.

## Fix

Make the PIN reach the primary parent reliably, regardless of who runs check-in.

### 1. Edge function to deliver the pickup PIN (server-side, service role)

New function `supabase/functions/send-pickup-pin/index.ts`:

- Inputs: `{ tenant_id, checkin_ids: string[], pin, recipient_member_ids: string[], child_first_names: string[] }`.
- Validates caller has tenant access AND is a Children's Church worker (admin, unit_leader, wsf_leader, or assigned worker — same check used by `checkin_child`).
- Re-loads recipient members (`user_id`, `email`, `phone`, `first_name`) with service role.
- For each recipient:
  - Inserts an in-app `notifications` row (bypasses RLS because it uses service role).
  - If `email` present, calls `send-email-alert` with the existing PIN email body.
  - If `phone` present, calls `send-sms` with the existing PIN SMS body.
- Returns `{ notified, emailed, smsed, errors: [...] }`.
- `verify_jwt = true`; add entry to `supabase/config.toml`.

### 2. Update `src/pages/ChildrenChurch.jsx` `checkIn` mutation

Replace the current three blocks (in-app notify, walk-in email, walk-in SMS) with a single call to `send-pickup-pin` after `checkin_child` succeeds:

- Collect `recipient_member_ids` = primary guardian + brought-by (deduped).
- Pass `pin`, `checkin_ids`, `tenant_id`, child first names.
- Toast based on the function's response (e.g. "Pickup PIN sent: in-app, email, SMS").
- Keep the issued-PIN modal (`setIssuedPin`) as the in-person fallback.

This removes the walk-in vs. account-holder branching — every primary parent gets the PIN via every channel they have.

### 3. One-off: resend Silver's PIN now

After deploying the function, invoke it for the two open check-ins (`13937792…` and `2b9e539c…`) with the existing PIN (we'd need to re-generate, since the DB only stores the hash). Two options:

- **Recommended:** generate a fresh PIN, call new RPC `reset_checkin_pin(_checkin_id, _pin)` (security-definer, worker-only) to update `pin_code_hash` on the two rows, then call `send-pickup-pin` to deliver it to Silver. Add this RPC in the same migration.
- Or have Silver re-check-in (loses the existing check-in record).

### Out of scope

- Changing the `notifications` RLS policy (would widen write access for all callers; the edge function is a narrower fix).
- Reworking the leader-override pickup notifications (already work).
- Any UI for parents to view/regenerate PIN themselves.

## Technical notes

- `send-pickup-pin` mirrors the auth pattern of `resolve-nearest-pickup` (validate `Authorization` Bearer with `supabase.auth.getUser`, then proceed with service role).
- Worker check: `is_admin(uid, tenant) OR has_role(uid, 'unit_leader', tenant) OR has_role(uid, 'wsf_leader', tenant) OR EXISTS member assigned as cc_worker` — reuse whatever `checkin_child` RPC enforces (need to read its definition before finalizing).
- `reset_checkin_pin` RPC: `security definer`, `set search_path = public`, updates `pin_code_hash = crypt(_pin, gen_salt('bf'))` using the same hashing used by `checkin_child`.
- No schema changes beyond the new RPC; no new tables.
