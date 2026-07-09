## Goal
Make the certificate's student number match the member's existing `course_registrations.student_number` (allocated at registration), instead of allocating a fresh sequence when the certificate is issued. Fall back to allocation only when no registration number exists.

## Root cause recap
Currently `issue-certificate` calls `next_student_number()` for Bible School courses, which computes `MAX(seq) + 1` across `training_completions` + `course_registrations` for the `TENANT/COURSE/MONTH/YEAR/` prefix. Romoke registered 3rd for BCC July 2026, so completion got `003` — that number is correct as an allocation, but it doesn't match her registration number and can drift as more people register.

## Changes

### 1. `supabase/functions/issue-certificate/index.ts` (lines ~276–297)
Before calling `next_student_number`, look up the member's existing registration for this course:

```ts
if (isBibleSchool && courseRow && !studentNumber) {
  const { data: reg } = await supabase
    .from("course_registrations")
    .select("student_number")
    .eq("tenant_id", tenant_id)
    .eq("course_id", courseRow.id)
    .eq("member_id", member_id)
    .not("student_number", "is", null)
    .order("registered_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (reg?.student_number) {
    studentNumber = reg.student_number;
    certificateNumber = studentNumber;
  }
}
// only allocate a fresh number if still missing
if (isBibleSchool && courseRow && !studentNumber) {
  // existing next_student_number RPC call
}
```

Behaviour:
- Existing completions with a `student_number` are untouched (the `existing?.student_number` guard already handles this).
- New certificates reuse the registration number.
- If a member somehow has no registration row, we still fall back to `next_student_number` so nothing breaks.

### 2. Statement of Result alignment
`supabase/functions/_shared/generate-statement.ts` and `src/components/exams/StatementOfResult.jsx` already read `course_registrations.student_number` first via `deriveStudentNumber`, so no change is needed there — after fix #1 the certificate, statement, and email will all show the same number.

### 3. Data backfill for Romoke (one-off)
Update her existing completion row so the printed certificate reflects the corrected number:

```sql
UPDATE training_completions
SET student_number = 'WCIC/BCC/JULY/2026/002',
    certificate_number = 'WCIC/BCC/JULY/2026/002'
WHERE student_number = 'WCIC/BCC/JULY/2026/003';
```

(Assumes her registration number is `…/002`. I'll confirm from `course_registrations` before running the update.)

### 4. Out of scope (flagged, not fixed here)
- Duplicate `…/001` in `course_registrations` — the registration-side allocator has a race. Happy to address in a follow-up if you want; the fix would be a similar server-side RPC + unique index on `(tenant_id, student_number)`.

## Verification
- Issue a fresh certificate for a new BCC July 2026 registrant → certificate `student_number` equals their `course_registrations.student_number`.
- Open Statement of Result dialog for Romoke → shows `…/002`.
- Reissue Romoke's certificate → keeps `…/002` (uses `existing.student_number`).
