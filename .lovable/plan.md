## Goal

When someone applies via the public Bible School form and a new member record is created for them, mark their `membership_status` as **"Bible School"** instead of **"First Timer"**. Existing members keep their current status untouched.

## Changes

### 1. DB migration — extend the `membership_status` enum
Add `'Bible School'` to the existing `public.membership_status` enum. No data backfill; only new applicants get the new value going forward. (If you want, we can also retro-tag existing members who have an approved Bible School registration — flag me if so.)

### 2. `supabase/functions/public-wofbi-register/index.ts`
- Change the new-member insert from `membership_status: "First Timer"` to `membership_status: "Bible School"`.
- No change to the "existing member found by email/user_id" branch — we don't overwrite their status.

### 3. Frontend — surface the new status

Add `"Bible School"` to the status dropdowns and badge colours so admins can see/filter it consistently:

- `src/components/members/MemberFormDialog.jsx` — add to `STATUSES`.
- `src/pages/MyProfile.jsx` — add to both `MEMBERSHIP_STATUSES` arrays and the badge colour map.
- `src/pages/Members.jsx` — add a badge colour entry (reuse an existing chart token).
- `src/components/members/BulkImportDialog.jsx` — add to `VALID_STATUSES` so CSV imports accept it.

Do not add it to `HIDE_SPIRITUAL_STATUSES` / `SHOW_BAPTISM_STATUSES` — Bible School applicants are typically already established members, so spiritual/emergency-contact sections should remain visible.

## Out of scope
- No changes to Applications tab / Bible School Management logic.
- No retroactive update of existing "First Timer" records — only new public applicants going forward.
- No changes to reporting, follow-up categorisation, or WSF/leader dashboards; those keep treating "First Timer" as-is.

## Result
- Public Bible School application → new member created with `membership_status = "Bible School"`.
- Existing members keep their current status when they apply.
- Admins can see, filter, edit, and bulk-import the "Bible School" status everywhere member status appears.
