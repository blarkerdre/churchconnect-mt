## Goal

Replace the current on-screen and printed Statement of Result with a layout that mirrors the uploaded reference:

- Centered institute logo
- Church / centre header ("CARDIFF LEARNING CENTRE" style)
- Section title: **STATEMENT OF RESULT**
- Course + session line (e.g. "BASIC CERTIFICATE COURSE AUGUST 2025")
- **NAME:** _Student Name_ ................ _Reference number_
- Two-column table: **Module Title** | **Grades**
- Final row: **Overall Result: _<classification>_**
- **Explanatory Notes** grade key
- Signature image (from the course's certificate template)

Applies to every Bible School course (BCC, LCC, LDC) — same layout, driven by course + tenant data.

---

## Grade scheme (agreed)

Add a shared letter-grade mapping in `src/lib/grade-utils.js`:

| % range | Letter | Label |
|---|---|---|
| 90–100 | A+ | Excellent |
| 80–89 | A | Merit |
| 70–79 | B | Very Good |
| 60–69 | C | Good |
| 50–59 | D | Average |
| 40–49 | E | Pass |
| 0–39 | F | Fail |

Per-subject cell shows the **letter** only.
Overall Result row keeps the course-level classification (Distinction / Merit / Pass) already computed from `course.grade_classifications`.

---

## Student reference number (auto-generated)

Format: `{TENANT_CODE}/{COURSE_CODE}/{SESSION}/{SEQ}`
Example: `WCIC/BCC/AUGUST/2025/101`

Composition rules (all computed client-side, no schema changes):

- **TENANT_CODE** — use `tenants.slug` uppercased, or first letters of `tenants.name` if slug is long; strip non-alphanumerics.
- **COURSE_CODE** — from `exam_titles.course_code` if set, else derived from parentheses in name (e.g. "Basic Certificate Course (BCC)" → `BCC`), else initials.
- **SESSION** — from the exam session tied to the student's attempts: `MONTH/YEAR` (uppercase month name).
- **SEQ** — the student's 1-based order among `course_registrations` for this course + tenant + session, sorted by `created_at`. Left-padded to 3 digits starting at 101 (matches sample).

Not persisted; regenerated deterministically each time the statement opens.

---

## Session detection

Look up the student's `exam_attempts` for subjects belonging to this course, join to `exam_sessions` via `exam_session_courses`, and take the most recent session's `starts_at` (or `name`). Fall back to today's month/year if none found.

---

## Files to change

1. **`src/lib/grade-utils.js`** — add `getLetterGrade(percentage)` returning `{ letter, label }` using the fixed bands above. Keep existing `getGradeClassification` untouched (still used for overall result).

2. **`src/components/exams/StatementOfResult.jsx`**
   - Add props: pull `currentTenant` (already there) and query for `exam_sessions` + `course_registrations` sequence on open (small `useEffect` with Supabase).
   - Replace the on-screen table with the 2-column Module / Grade layout mirroring print.
   - Rewrite `handlePrint` HTML template to match the reference exactly:
     - Centered `<img>` logo, church name, centre name, "STATEMENT OF RESULT", course + session line.
     - Name row with reference number right-aligned.
     - Modules table with grey header, tight rows, letter grade right-aligned.
     - Overall Result row spanning the grade column.
     - Explanatory Notes block (static grade key).
     - Signature image + "Dean / WOFBI" text pulled from the course's `certificate_templates` record (`signatory_name`, `signature_image_url`) when available; falls back to blank signature line.
   - CSV export left as-is (add letter grade column).

3. **No DB changes.** All new values are derived at render time.

---

## Out of scope

- Emailing the statement PDF automatically (existing "Email Result Statement on Completion" flow keeps its current template unless requested).
- Persisting the reference number.
- Editable per-tenant grade bands (fixed to match WOFBI sample).

---

## Verification

- Open Exam Management → any Bible School course → Statement for a student with attempts → confirm on-screen table + Print preview match the reference layout, letter grades render, overall classification correct, reference number composes as expected.
- Test on BCC, LCC, LDC to confirm same layout applies to all three.
