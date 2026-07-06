# Hide student registration number until approval

Keep the DB trigger that pre-assigns `student_number` on insert (so admins can see and edit the number on pending rows). Only change what the **student** sees.

## Changes

1. **`supabase/functions/public-wofbi-register/index.ts`**
   - Remove `.select("student_number").single()` after the insert; go back to a plain insert.
   - Remove `student_number` from the JSON response. Response becomes `{ success, course_name }` again.

2. **`src/pages/PublicWoFBIRegistration.jsx`**
   - Remove `studentNumber` state, the `setStudentNumber(...)` call, the provisional number card, and the dynamic branch in "What's next?".
   - Restore the original message: the number will be issued once an administrator approves the registration.

3. **Course registration confirmation email (`send-course-registration-email`)**
   - Verify it does not include the student number. If it does, remove that line so the student isn't shown the number pre-approval.

4. **Post-approval visibility (already working, just confirm — no code change expected)**
   - `MyProfile.jsx` already renders `reg.student_number` on the member's course card once present.
   - Admin approval flow (`approve_course_registration`) stamps `status='approved'`; the number was already set by the insert trigger, so it will appear to the student as soon as their registration is approved.

## Out of scope
- No changes to the DB trigger or `next_student_number` — admins still see/edit the number on pending rows in `ExamManagement` → Course Registrations.
- No new post-approval email (existing MyProfile display is the surface).
- No backfill.
