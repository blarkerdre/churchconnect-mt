## Goal
Capture Occupation and Nationality for members, in the registration/member forms.

## Current state (verified)
- The `members` table has no `occupation` or `nationality` columns (49 columns checked — closest existing fields are `how_did_you_hear`, `address`, `city`).
- Occupation/Nationality exist today only inside the Bible School application form schema (`src/lib/wofbi-form-defaults.js`), stored as free-form answers — unrelated to the member record.

## Changes

1. Database
   - Add `occupation text` and `nationality text` (nullable) to `public.members`.

2. Public registration (`src/pages/PublicRegistration.jsx`)
   - Add two optional text inputs (Occupation, Nationality) in the personal-details block, included in the insert payload.

3. Admin member form (`src/components/members/MemberFormDialog.jsx`)
   - Add the same two fields to the personal-details section, wired into `emptyMember`, load and save.

4. Member profile (`src/pages/MyProfile.jsx`)
   - Show/edit the same two fields so members can complete them after registration.

5. Display/export
   - Show Occupation and Nationality in the member detail view, and include them in the members CSV export and bulk-import column mapping so data round-trips.

## Notes
- Both fields optional (not required) and free text, max 100 characters.
- Bible School application form is unchanged; its own occupation/nationality answers stay as-is.
