## Quality Control tab for Bible School Management

Add a new "Quality Control" tab to the Bible School Management page (`ExamManagement.jsx`) alongside Management and Lecturer Feedback. Admins/QC team members submit a QC checklist per lecturer per class session; the tab lists, filters and reports on QC entries.

### 1. Database migration — new table `lecturer_qc_checks`

Tenant-scoped, one submission per QC team member per (lecturer + course + date). Columns beyond standard `id`, `tenant_id`, `created_at`, `updated_at`, `created_by`:

- `lecturer_id` (FK `lecturers`), `exam_title_id` (course, FK), `exam_subject_id` (subject, FK, nullable)
- `check_date` (date), `tier` (text: BFC/BCC/LCC/LDC — copied from lecturer level, editable)
- `started_on_time` (smallint 1–5 score), `finished_on_time` (smallint 1–5)
- `introduced_self` (bool)
- `orderliness_note` (text), `orderliness_score` (smallint 1–5)
- `content_focus_note` (text), `content_focus_score` (smallint 1–5)
- `conducted_test` (bool)
- `qa_observations` (text)
- `general_observations` (text)
- `class_recorded` (bool), `recording_submitted` (bool)
- `total_score` (smallint, auto = sum of 4 numeric scores, computed client-side and stored)
- `student_avg_rating` (numeric, snapshotted from `lecturer_ratings` at submission time — optional)
- `qc_member_name` (text — free text of QC team member)

GRANT SELECT/INSERT/UPDATE/DELETE to authenticated, GRANT ALL to service_role. Enable RLS. Policies: tenant admins (via existing `is_tenant_admin` helper pattern used elsewhere) can do all; other authenticated users no access. Same shape as `lecturer_ratings` policies.

### 2. Shared options file

New `src/lib/qc-options.js` exporting `SCORE_LABELS = {1:"Very poor",2:"Poor",3:"Average",4:"Good",5:"Excellent"}` and the checklist field metadata used by both the form and report.

### 3. New form dialog — `src/components/exams/QcCheckDialog.jsx`

Mirrors the printable template exactly:
- Header fields: Lecturer (select from tenant lecturers), Date (defaults today), Course & Tier (course select + tier auto-filled from lecturer.level, editable), Subject (optional select filtered by course), QC Team Member name.
- Items 1–10 in the same order/labels as the docx.
- Numeric scores rendered as 1–5 radio pills with label helper; Yes/No items as radio group.
- Live "Total score" readout at the bottom (sum of 4 scored items, max 20).
- Save writes to `lecturer_qc_checks` with `withTenant`. Toast on success.

### 4. New report component — `src/components/exams/QcReport.jsx`

Rendered inside the new Quality Control TabsContent, structured like `LecturerFeedbackReport` for consistency:

- **Header actions:** "New QC Check" (opens `QcCheckDialog`), "Export CSV", `PrintReportButton` using project's shared button.
- **Filters (client-side):** course, subject, lecturer, tier, date range, QC team member search, min total score slider.
- **Summary cards:** total checks, unique lecturers checked, avg total score, % started on time (score ≥ 4), % finished on time, % introduced self, % test conducted, % class recorded, % recording submitted.
- **Tabs inside card:**
  1. **Entries** — table: date, lecturer, course, tier, QC member, total score, actions (view detail dialog rendering the full checklist read-only; edit; delete with confirm).
  2. **By lecturer** — lecturer, checks, avg total, avg orderliness, avg content focus, % on-time start.
  3. **By course** — course, checks, avg total.
  4. **Distribution** — recharts histogram of total score bucketed 0–20; Tailwind bars for Yes/No fields.

CSV columns match all checklist fields plus totals.

### 5. Wire into `ExamManagement.jsx`

- Change existing `Tabs` from 2 columns to 3: Management | Lecturer Feedback | **Quality Control**.
- Gate the new tab behind the same admin condition already used for Lecturer Feedback tab.
- Mount `<QcReport />` in the new `TabsContent value="qc"`.

### Out of scope
- No changes to student-facing lecturer rating flow.
- No PDF export of the printable checklist (CSV + Print Report cover reporting).
- No per-QC-member roles/permissions beyond tenant admin.

### Files
- **New migration** creating `lecturer_qc_checks` with grants, RLS, policies, updated_at trigger.
- **New** `src/lib/qc-options.js`
- **New** `src/components/exams/QcCheckDialog.jsx`
- **New** `src/components/exams/QcReport.jsx`
- **Edit** `src/pages/ExamManagement.jsx` — add third tab and mount `QcReport`.
