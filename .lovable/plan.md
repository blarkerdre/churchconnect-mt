# Plan: Set "Bible School" status only on approval

Right now the public registration edge function sets `members.membership_status = 'Bible School'` at submission time. Move that assignment so it only happens when an admin approves the application.

## Changes

### 1. `supabase/functions/public-wofbi-register/index.ts`

- When creating a new `members` row for a public applicant, set `membership_status = 'Visitor'` instead of `'Bible School'`.
  - Rationale: matches the semantic — they've expressed interest but aren't enrolled yet. `Visitor` is an existing status already used elsewhere in the app.
- When linking to an existing member (same email in tenant), do **not** touch `membership_status`.
- Keep everything else identical: `gdpr_consent`, `gdpr_consent_date`, tenant scoping, `wofbi_applications` insert with `status = 'submitted'`.

### 2. Approval trigger — no change needed

`trg_ensure_member_for_wofbi_app_ins/upd` (from the earlier migration) already inserts new members with `membership_status = 'Bible School'` on approval.

Add one small change to that function: when approval fires and a member already exists **with status `'Visitor'`** (i.e. the applicant we created at submission time), update them to `'Bible School'`. Do **not** overwrite any other status (Active, First Timer, New Convert, etc. stay as-is).

This is a `CREATE OR REPLACE FUNCTION` migration — no schema change.

### 3. Existing data

Applicants who are currently sitting with `membership_status='Bible School'` but whose application is still `submitted` (not yet approved) should be reverted to `'Visitor'` so the new rule is consistent.

Handled by a one-off data update:

```
UPDATE members m
SET membership_status = 'Visitor'
WHERE m.membership_status = 'Bible School'
  AND EXISTS (
    SELECT 1 FROM wofbi_applications a
    WHERE a.member_id = m.id AND a.status = 'submitted'
  )
  AND NOT EXISTS (
    SELECT 1 FROM wofbi_applications a2
    WHERE a2.member_id = m.id AND a2.status = 'approved'
  );
```

Members whose application is already approved keep `'Bible School'`. Members with other statuses are untouched.

## Not changing

- `wofbi_checkin` RPC.
- Application form / QR / attendance flows.
- Magic-link check-in.
- Admin UI.

## Technical notes

- The trigger update is a `SECURITY DEFINER` function replacement; the trigger binding stays the same.
- No new columns, no RLS changes, no GRANT changes.
