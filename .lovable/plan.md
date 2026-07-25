## Current state

Data processing consent (`gdpr_consent`) is already required on:
- Public member registration (`PublicRegistration.jsx`)
- Public Bible School registration (`PublicWoFBIRegistration.jsx`)
- Member self-profile creation (`MyProfile.jsx`)
- New-member creation via `MemberFormDialog.jsx` (guard: `!member && !form.gdpr_consent`)

Gap: when an admin/leader **edits** an existing member in `MemberFormDialog.jsx`, the consent checkbox is not enforced — historic records without consent can be saved indefinitely, and the checkbox can be unticked on edit without blocking save.

## Plan

Make `gdpr_consent` compulsory on every save path, including edits.

1. `src/components/members/MemberFormDialog.jsx`
   - Change the submit guard from `!member && !form.gdpr_consent` to just `!form.gdpr_consent` (toast: "Data processing consent is required").
   - Update the Save button `disabled` prop the same way.
   - When saving an edit that toggles consent from false→true, set `gdpr_consent_date = now()`; keep existing date when it was already true. When a member loads with existing `gdpr_consent = true`, keep the box ticked (current behaviour).
   - Keep the red "Consent is required" hint visible whenever the box is unticked, on both create and edit.

2. No schema change and no changes to public/self-registration flows — they already enforce it.

3. Verify by editing an existing member with the box unticked → save should be blocked with the toast; ticking it and saving should stamp `gdpr_consent_date`.

## Out of scope

- Cookie banner, granular consent toggles (marketing/photos/pastoral), and children/teen parental consent are separate consents already handled elsewhere and stay as-is.
