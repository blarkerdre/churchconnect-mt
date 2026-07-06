## Goal
Assign a student registration number **at the moment of registration** (public form and member self-registration) so admins see and can edit it in Course Registrations *before* approval. Approval no longer generates the number; it just marks the row approved.

## Why
Today `course_registrations.student_number` is only populated when an admin clicks **Approve** (`approve_course_registration` RPC). The public success screen already promises "your student number will be issued once an admin approves", and admins can only edit the number after approval fills it in. You want the number visible/editable up-front.

## Changes

### 1. Edge function `public-wofbi-register` (`supabase/functions/public-wofbi-register/index.ts`)
After a successful `course_registrations` insert:
- Call the existing `next_student_number(tenant_id, course_id, current_date)` RPC (service role, so RLS/auth check bypassed).
- `UPDATE course_registrations SET student_number = <generated>` for the new row.
- Include `student_number` in the JSON response.

### 2. Public success screen (`src/pages/PublicWoFBIRegistration.jsx`)
- Store `student_number` from the response alongside `course_name`.
- If present, show it prominently on the "Registration Received!" card ("Your student registration number: **BFC-26-0001**"). Keep the "pending admin approval" copy, but change it to say the number is provisional until approved.

### 3. Member self-registration path (if any)
Audit where authenticated members create `course_registrations` rows directly (search for `.from("course_registrations").insert`). Any client-side insert path gets the same auto-assignment via a small `assign_student_number_on_registration` trigger (below) so we don't have to touch every caller.

### 4. Migration — trigger + RPC tweak
- **New BEFORE INSERT trigger** on `course_registrations`: if `NEW.student_number IS NULL`, set it to `public.next_student_number(NEW.tenant_id, NEW.course_id, CURRENT_DATE)`. This covers the edge function insert *and* any client-side insert atomically, and eliminates a race between insert + update.
  - Drop the manual UPDATE from the edge function once the trigger is in place; the function just re-reads the row to return the number.
- **Update `approve_course_registration`**: keep the existing "reuse existing number" branch, but since numbers will always be pre-assigned, the function effectively just flips status/approved_at/approved_by. No behaviour change for old rows that still have NULL numbers.

### 5. Admin UI (`src/pages/ExamManagement.jsx`, `CourseRegistrationsView`)
- Already renders the number and has an edit pencil for admins on every row regardless of status — **no change needed** beyond visual confirmation the pending rows now show the pre-assigned number.
- Keep the existing `updateNumberMutation` (admin edit) unchanged; it will overwrite the auto-assigned number when needed.

### 6. Member profile (`src/pages/MyProfile.jsx`)
No change — it already renders `reg.student_number` when present, so it will show up immediately after registration.

## Out of scope
- Backfilling `student_number` for existing pending registrations (they'll still get a number the first time an admin edits/approves them, unchanged behaviour).
- Changing the numbering format or reset scope (still per course, per month, floor-only, defined by course/exam_title settings — matches the earlier decision).
- Changing who can edit numbers (still admin-only via `canManageNumbers`).

## Technical notes
- `next_student_number` is `SECURITY DEFINER` and already granted to `authenticated, service_role`; safe to call from the trigger.
- Trigger runs as the inserting role; using the SECURITY DEFINER helper is fine because it doesn't consult `auth.uid()`.
- Unique index `course_registrations (tenant_id, student_number) WHERE student_number IS NOT NULL` already exists — if two inserts race for the same slot, one will fail and the client retries the registration. Acceptable given very low contention. (If we want zero-retry, wrap the trigger's number generation in a `SELECT ... FOR UPDATE` on a per-course lock table — noted but not implemented.)
