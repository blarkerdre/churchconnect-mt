## Goal

Let admins set a per-course starting number for the monthly student registration sequence. Applied as a floor: the next issued number is `max(existing_max_this_month + 1, starting_number)`.

## 1. Data model

- Add `starting_number INTEGER NOT NULL DEFAULT 1` to `public.exam_titles`.
- Constraint: `starting_number >= 1`.

## 2. Numbering function

- Update `public.next_student_number(_tenant_id, _course_id, _completion_date)`:
  - Compute current max sequence for `(tenant_id, course_id, month, year)` across `course_registrations.student_number` and `training_completions.student_number` (unchanged logic).
  - Read `starting_number` from `exam_titles`.
  - Next N = `GREATEST(current_max + 1, starting_number)`.
  - Format the WCIC/BCC/MONTH/YYYY/NNN string exactly as today.

Behaviour:
- First registration of the month → uses `starting_number` (e.g. set to 200 → first number is `.../200`).
- Subsequent → increment from there.
- Lowering `starting_number` below the existing max has no effect that month (floor only, no overwrites).

## 3. UI

- **Course form in `ExamManagement.jsx`** (Bible School course editor): add "Starting registration number" input (default 1, min 1), with helper text: *"The first registration each month will use this number or the next available one, whichever is higher. Existing numbers are never changed."*
- Editable by tenant admins/owners only (same guard as other course fields).
- No UI change on the registration/approval flow — the new floor is applied automatically when approval calls `next_student_number`.

## 4. QA

- Set starting_number = 500 on a course with no registrations this month → next approval issues `.../500`, then `.../501`.
- Set starting_number = 10 on a course where max this month is already `.../42` → next approval issues `.../43` (floor ignored because max is higher).
- New month → sequence resets and again respects the starting number.
- Non-admin cannot edit the field (RLS on `exam_titles` unchanged).

## Out of scope

- Renumbering already-issued registrations.
- Per-month overrides or scheduled changes.
- Tenant-wide default (per-course only, as chosen).

## Technical summary

- **DB migration**: `ALTER TABLE public.exam_titles ADD COLUMN starting_number INTEGER NOT NULL DEFAULT 1 CHECK (starting_number >= 1);` and `CREATE OR REPLACE FUNCTION public.next_student_number(...)` to apply `GREATEST(max+1, starting_number)`.
- **Frontend**: course create/edit form in `src/pages/ExamManagement.jsx` gains a `starting_number` numeric field wired into the existing insert/update payload.
