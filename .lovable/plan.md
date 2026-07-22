## Goal

1. Make parental consent **mandatory** in My Family for both children and teens (children already enforced; teens currently optional).
2. Let Children's Church unit leaders see each **type** of consent per child, and Teens Church unit leaders see consent for each teen.

## Changes

### 1. My Family — make teen consent mandatory
`src/components/teens/TeensSection.jsx`
- In the `save` mutation, throw `"Parental consent is required to save this teenager"` when `form.attendance_consent` is false (mirror the child rule in `MyFamily.jsx`).
- Set the consent checkbox default to `true` for new teens (parents must actively untick to opt out, matching UX intent) and highlight the block in destructive tone when unchecked.
- Disable the Save button while consent is false and show inline helper text.

`src/pages/MyFamily.jsx` — already enforces `parental_consent_given` for children; no change needed beyond a small copy tweak to state it is required.

### 2. Children's Church leader view — show consent types
`src/pages/ChildrenChurch.jsx`
- Extend the leader-visible `children` selects (three spots around lines 467/507/521) to also fetch `consent_photos, consent_pastoral_contact, consent_medical_emergency, consent_notes, parental_consent_at`.
- In the family detail panel (around the child card at line 720), render a small "Consents" row of badges: Data (required), Photos, Pastoral contact, Medical emergency — green when granted, muted when not. Show the `consent_notes` under the badges when present, and the consent date if available.

### 3. Teens Church leader view — show consent types
`src/pages/TeensAttendance.jsx`
- In the check-in panel teen list (around line 265) and the report table, add a consent badge next to each teen: green "Consent given · {date}" or amber "Consent needed" (data already loaded via `teens` query — extend the select to include `attendance_consent, attendance_consent_at`).
- Add a lightweight "Registered Teens" dialog trigger for Teens Church leaders that lists all teens with columns: name, guardian, gender, DOB, consent status + date. Filter by consent (all / given / needed). No new tables — reuses existing `teens` rows via tenant-scoped select.

### Access / RLS

No schema changes. Existing RLS on `teens` and `children` already allows unit leaders to read their unit's records; only the selected columns change.

## Technical notes

- Consent enforcement is client-side (form validation) since the DB columns are nullable by design (parents can revoke). RLS already blocks teen check-in when `attendance_consent` is false via the `teen_checkin` RPC.
- No migration required.
