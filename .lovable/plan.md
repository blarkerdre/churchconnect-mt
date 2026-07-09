## Why the button is hidden

The "Rate a Lecturer" button in `MemberExamsView` (src/pages/ExamManagement.jsx) is only rendered when **all** of these are true:

1. The signed-in user is **not an admin** — admins get the `LecturerManager` panel instead and never enter `MemberExamsView` (see line 267–268: `if (!isAdmin) return <MemberExamsView …/>`).
2. `currentTenant.settings.wofbi_lecturer_rating_enabled === true` for the tenant the user is currently browsing.
3. The user has a linked `members` row (`myMember?.id`) in that tenant.

Current DB state confirms only **Winners Chapel Cardiff** has the toggle on and has one active lecturer ("Ade"). Demo Church (TEST) and the other tenants have the toggle unset, so no student on those tenants will see the button. The console logs from this session are from a user on Demo Church, which explains why nothing shows.

## Fix

Make the entry point discoverable regardless of role, and add a small diagnostic when the toggle is off.

1. **Show "Rate a Lecturer" to admins too**, from the admin Bible School view (top of `ExamManagement` admin section, near the LecturerManager card). Same gating: toggle on + at least one active lecturer + admin has a linked `members` row. Reuses the existing `RateLecturerDialog`.
2. **Keep the student button**, but drop the "at least one active lecturer" implicit assumption — the dialog already handles the empty state, so the button visibility only depends on the tenant toggle + `myMember?.id`.
3. **Empty-state hint for admins**: in `LecturerManager`, when the toggle is ON but there are 0 active lecturers, show a small inline note: "Add an active lecturer so students can submit ratings."
4. **No DB changes.** No changes to gating logic beyond the above.

## Files

- Edit `src/pages/ExamManagement.jsx` — add the admin-side "Rate a Lecturer" button + dialog mount.
- Edit `src/components/exams/LecturerManager.jsx` — inline empty-state hint when toggle is on but no active lecturers.

## Verification

- As Cardiff admin: see the LecturerManager panel and a "Rate a Lecturer" button; opening it lists "Ade".
- As Cardiff member (non-admin) with a linked `members` row: see the "Rate a Lecturer" button on the Bible School page.
- On Demo Church (toggle off): neither admin nor student sees the button — enabling the toggle in Bible School → Lecturer Feedback makes it appear.
