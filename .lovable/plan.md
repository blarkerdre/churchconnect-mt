## Goal
Require an explicit data-processing consent (GDPR-style) before a parent can save a child or teenager record in My Family — mirroring the mandatory `gdpr_consent` on members.

## Current state (verified)
- **Children** (`MyFamily.jsx`): already requires `parental_consent_given` ("I am the parent/legal guardian and consent to my child's data being held and processed"). This IS the data-processing consent → no change needed beyond copy tightening.
- **Teenagers** (`TeensSection.jsx`): only requires `attendance_consent` (scoped to on-premises check-in/out). There is **no** separate data-processing consent. The `teens` table has no data-processing column.

## Changes

### 1. Database (migration)
Add data-processing consent columns to `public.teens`:
- `data_processing_consent boolean NOT NULL DEFAULT false`
- `data_processing_consent_at timestamptz`
- `data_processing_consent_by uuid`

Backfill existing rows so current teens aren't blocked: set `data_processing_consent = true`, `data_processing_consent_at = created_at`, `data_processing_consent_by = primary_guardian_member_id` for all pre-existing rows. (Going forward, new rows require the parent to tick the box.)

### 2. Teens form (`src/components/teens/TeensSection.jsx`)
- Add a second required consent block above/next to attendance consent:
  - "I am the parent/legal guardian and consent to my teenager's data being held and processed *"
- Track `data_processing_consent` in form state; default `false` for new, current value for edits.
- Block save (`throw` + disable Save button) when `data_processing_consent` is false — same pattern already used for `attendance_consent`.
- On save, stamp `data_processing_consent_at` / `_by` when it flips from false→true; preserve existing timestamps on edit.
- Show "Consent given on <date>" line when already granted, matching the attendance-consent UX.

### 3. Children form (`src/pages/MyFamily.jsx`)
- Keep the existing mandatory `parental_consent_given` switch (it already covers data processing).
- Tighten the label copy to make the data-processing scope explicit: "I am the parent/legal guardian and consent to my child's personal data being held and processed for church ministry purposes *"
- No schema or logic changes; enforcement already exists.

### 4. Leader visibility (optional, small)
- Teens Attendance registered-teens directory (`TeensAttendance.jsx`) already shows an attendance-consent badge. Add a second small badge / column for "Data processing" consent date so the Teens Church leader can see both, matching the Children's Church "Parental consent" badge pattern.

## Out of scope
- No changes to member (`MemberFormDialog`) — already enforced last turn.
- No changes to public forms, RLS, or consent revocation flows.
- No SMS/email/notification changes.
