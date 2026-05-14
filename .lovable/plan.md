## Goal

Allow members of the **Follow-up** church unit (not just admins/unit leaders) to send SMS/WhatsApp and place phone calls — but only for follow-up records they created or are assigned to in their tenant.

## Behaviour

A non-admin, non-leader user is permitted to call `send-sms` or `make-call` only when **all** of these hold:
1. They belong to the tenant (`user_belongs_to_tenant`).
2. They are an active member of the tenant's Follow-up unit (their `members.church_unit` matches a Follow-up unit in `church_units`).
3. The request carries `reference_type = "followup"` and a `reference_id` that points to a `followups` row in the same tenant where `assigned_to = user.id` OR `created_by = user.id`.

Anything outside that scope (bulk sends, non-followup messages, other tenants' rows) still requires admin or `unit_leader`. Admins and unit leaders keep their current unrestricted access.

## Changes

### 1. Database — new helper RPC
Add `public.user_is_followup_unit_member(_user_id uuid, _tenant_id uuid) returns boolean` (SECURITY DEFINER, `search_path=public`):
- Returns true when a row exists in `members` with that `user_id`, `tenant_id`, `status` active, and `church_unit` matching (case-insensitive) any `church_units.name` for the tenant whose name ILIKE `%follow%up%` or equals `Followup`/`Follow-up`/`Follow Up`.

### 2. `supabase/functions/send-sms/index.ts`
After the existing `isAdmin || isLeader` check fails, before returning 403:
- If `recipients.length === 1`, `sms_type === "followup"` (or `reference_type === "followup"`), and `reference_id` is set:
  - Call `user_is_followup_unit_member(userId, tenant_id)`. If false → 403.
  - Load the `followups` row by id + tenant_id; verify `assigned_to = userId` OR `created_by = userId`; verify the recipient phone matches the linked member's phone (or the followup's contact phone). If any check fails → 403.
- Otherwise → keep current 403.

### 3. `supabase/functions/make-call/index.ts`
Same pattern as send-sms, gated on `reference_type === "followup"` + `reference_id` + single recipient.

### 4. No UI changes
`FollowupMessageDialog` and `FollowupDetailPanel` already pass `reference_type: "followup"` and `reference_id`, so follow-up unit members will simply stop seeing the "Forbidden" toast for their own assigned/created follow-ups.

## Out of scope
- No new role in `app_role`.
- No change to bulk SMS, announcements, birthday messages, or pastoral care messaging.
- No change to RLS on the `followups` table itself.
- No UI permission badges or visibility toggles.

## Verification
- As a follow-up unit member assigned to a follow-up: send SMS + place call from the Follow-up detail panel → succeeds.
- Same user tries to send SMS to a follow-up they are **not** assigned to → 403.
- Same user tries a bulk send from Communications → 403.
- Admin/unit leader behaviour unchanged.