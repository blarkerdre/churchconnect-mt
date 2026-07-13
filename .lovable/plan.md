## Goal

1. Remove the "Resend exam sign-in link" button from the Bible School **Applications** tab. Sending/resending the exam link lives exclusively on the **Registrations** tab (already implemented).
2. Split delete behaviour so the Applications-tab delete and Registrations-tab delete no longer wipe each other's records.

## Changes

### 1. `src/components/exams/WoFBIApplicationsTab.jsx` — remove resend button
- Delete the `isApprovedStatus(a.status) && a.source === "form"` block (lines ~813–825) that renders the `Send` icon and calls `provisionExamAccount.mutate({ id: a.id })`.
- Remove the now-unused `provisionExamAccount` mutation definition and the `Send` icon import if nothing else references them.

### 2. `src/components/exams/WoFBIApplicationsTab.jsx` — application-only delete
Rewrite `deleteApplications.mutationFn` (lines 263–320) so it deletes **only** application-side records and leaves any course registration / exam attempts / certificate untouched:
- For `source === "form"` rows: delete the row's `exam_answers` (form response, if any), then delete the `wofbi_applications` row by id + tenant_id. Do **not** call `cascade_delete_bible_school_records`. No touching of `course_registrations`.
- For `source === "direct"` rows (which only exist because a registration exists without an application): show a disabled/hidden delete button, or keep the button but toast "Delete this from the Registrations tab" — no DB writes. Simpler: hide the Delete button in the row action cell when `a.source === "direct"`.
- Update toast copy: "Application deleted" / "Deleted N applications" — remove the "registration, exam attempts, results, certificate, ratings were also removed" line.
- Keep audit log entry as `wofbi_application.deleted` only.
- Invalidate only `["wofbi-applications", tenantId]` and `["wofbi-direct-registrations", tenantId]`; drop the `course-registrations` invalidation since we no longer touch it.

### 3. `src/pages/ExamManagement.jsx` — registration-only delete
Rewrite `deleteMutation.mutationFn` in the Registrations tab (lines 949–969) so it deletes **only** registration-side records and leaves the `wofbi_applications` row untouched:
- Instead of `cascade_delete_bible_school_records` (which also drops the application form response), inline scoped deletes in this order, all scoped by `tenant_id`:
  1. `exam_answers` for attempts belonging to this member + course
  2. `exam_attempts` where `member_id = reg.member_id AND course_id = course.id`
  3. `training_completions` / issued certificate rows for this member + course (whichever table the current cascade covers — mirror it)
  4. `lecturer_ratings` for this member + course
  5. `course_registrations` row by id
- Do **not** delete from `wofbi_applications` and do **not** delete the application's form-response `exam_answers`.
- Update toast copy: "Registration removed" / description: "Exam attempts, results, certificate and lecturer ratings for this course were also deleted. The Bible School application record was kept."
- Update the `DangerConfirmDialog` `impacts` list (lines ~1200–1208): remove the "Their Bible School application form response for this course will be deleted." bullet.

### 4. Confirm dialog copy on Applications tab
- Update the confirm dialog body (line ~930) to: "This will permanently delete the application for **{name}**. Their course registration, exam attempts, results and certificate (if any) will be kept — delete those from the Registrations tab."

## Technical detail

- Before implementation, view the SQL body of `cascade_delete_bible_school_records` (via `supabase--read_query` on `pg_proc`) to confirm exactly which tables it touches, so the split deletes in steps 2 and 3 cover the same rows minus the "other side".
- No schema/migration changes. No changes to `provision-exam-account` edge function or to the Registrations-tab Send/Resend button added in the previous change.

## Out of scope

- The RPC `cascade_delete_bible_school_records` itself is left in place (may still be used elsewhere / kept for safety).
- No changes to approval, provisioning, or email flows.

## Result

- Applications tab no longer offers Resend exam link.
- Deleting an application removes only the application (and its form response). Registration + exam data stay.
- Deleting a registration removes only the registration and its exam/certificate/rating data. The application row stays.
