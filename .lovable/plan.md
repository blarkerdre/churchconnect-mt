# Fix: "Rate a Lecturer" button hidden on Bible School → Feedback for WCI Cardiff

## Diagnosis

In `src/pages/ExamManagement.jsx` the admin "Rate a Lecturer" button is gated on two conditions:

```jsx
{adminLecturerRatingEnabled && myMember?.id && (
  <Button …>Rate a Lecturer</Button>
)}
```

- `adminLecturerRatingEnabled` — verified true for WCI Cardiff (`tenants.settings.wofbi_lecturer_rating_enabled = true`).
- `myMember?.id` — false for the current signed-in admin because they don't have a linked `members` row in the `wci-cardiff` tenant (typical for super-admin / cross-tenant admin).

`RateLecturerDialog` already tolerates a missing member (`member_id: myMember?.id || null` — see line 186), so the `myMember?.id` gate is unnecessarily strict.

## Change

Single-file frontend edit — `src/pages/ExamManagement.jsx` line 835:

- Drop the `myMember?.id` requirement so the button appears whenever the tenant setting is on and the user is an admin.
- Keep the tenant-setting gate untouched.

```diff
- {adminLecturerRatingEnabled && myMember?.id && (
+ {adminLecturerRatingEnabled && isAdmin && (
```

`isAdmin` is already destructured from `useAuth()` on line 61, so no new imports.

## Out of scope

- No changes to `RateLecturerDialog`, DB schema, RLS, or the member-facing rate button (line 1595) — that path still requires the member's own profile as expected.
- No changes to the tenant setting or to super-admin membership provisioning.

## Verification

Sign in as the WCI Cardiff admin, navigate to Bible School → Feedback tab; the "Rate a Lecturer" button appears in the top-right. Opening it lists lecturers and allows submission (member_id stored as null on the row).
