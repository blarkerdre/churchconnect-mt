## Changes

### 1. `src/components/exams/RateLecturerDialog.jsx` (student-facing)
- Remove the **Level** input field from the form grid.
- Remove `level` from `emptyForm`, from the "load existing rating" effect, and from the submit payload (send `level: null`, or drop the field entirely — DB column stays for legacy rows).
- No other question or field changes.

### 2. `src/components/exams/QcCheckDialog.jsx`
- Remove the **Tier** `<Select>` from the header grid.
- Remove `tier` from `emptyForm`, from the edit-record hydration, and from the auto-fill-from-lecturer-level effect (delete that effect entirely).
- Stop importing `TIER_OPTIONS`.
- In the submit payload, send `tier: null` (keep DB column for legacy rows).
- Subject is already validated as required (`if (!form.exam_subject_id) throw…`) and the trigger already shows `*`; no change needed there — the existing duplicate guard on `(tenant_id, lecturer_id, exam_subject_id)` plus the unique index already enforce "one QC per lecturer per subject", which correctly allows the same lecturer to have separate QC entries for different subjects in the same course.

### 3. No DB migration
- Existing unique index `lecturer_qc_checks_lecturer_subject_uniq` on `(tenant_id, lecturer_id, exam_subject_id)` already provides the required rule. `tier` column is left in place (nullable) so historical rows are preserved; only the UI stops writing it.

### Files touched
- `src/components/exams/RateLecturerDialog.jsx`
- `src/components/exams/QcCheckDialog.jsx`
