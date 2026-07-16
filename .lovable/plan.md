## Bible School QC — Training Rep access & uniqueness

### 1. New tenant setting: `wofbi_qc_enabled`
- Add a toggle in `LecturerManager.jsx` (Bible School → Lecturer Feedback tab, next to existing "Lecturer rating" switch) that writes `tenants.settings.wofbi_qc_enabled`.
- Admin-only control.

### 2. Access to the QC tab for Training Rep members
- `ExamManagement.jsx` currently redirects any non-admin to `MemberExamsView`. Change the guard so that a signed-in member who is in the `Training Rep` church unit AND `wofbi_qc_enabled` is true renders a stripped-down Exam Management page showing **only** the "Quality Control" tab (no Management/Applications/App Form/Lecturer Feedback tabs, no Registration QR, no course editors).
- Admins keep the full view unchanged. The QC tab itself continues to render `QcReport`.

### 3. `QcReport.jsx`
- Show the "New QC Check" button when the user is admin OR (Training Rep member AND `wofbi_qc_enabled`).
- Show Edit action for admins and for Training Rep members on rows they created (`created_by = auth.uid()`).
- Show the Delete (trash) action **only for admins**.
- Filters/tabs/exports stay available to everyone who can see the tab.

### 4. `QcCheckDialog.jsx`
- Make **Subject required** (currently optional) — needed to enforce uniqueness per lecturer/subject.
- Replace the free-text "QC Team Member" input with a `Select` populated from members in the current tenant whose `church_unit` contains `"Training Rep"` (case-insensitive, comma-separated split — same logic as `useUnitMembership`). Store the chosen member's display name in the existing `qc_member_name` column so historical rows keep working; also store the selected `member_id` in a new column (see migration).
- Client-side pre-check: query `lecturer_qc_checks` for `(tenant_id, lecturer_id, exam_subject_id)` before insert; if one exists (and it isn't the record being edited), show a clear toast: "A QC check already exists for this lecturer and subject." No duplicate row is created.

### 5. Database migration
- `ALTER TABLE public.lecturer_qc_checks ADD COLUMN qc_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL;` (nullable; legacy rows keep their `qc_member_name`).
- `CREATE UNIQUE INDEX lecturer_qc_checks_lecturer_subject_uniq ON public.lecturer_qc_checks (tenant_id, lecturer_id, exam_subject_id);` (subject required from now on).
- New helper `public.is_training_rep_member(_user_id uuid, _tenant_id uuid)` — SECURITY DEFINER, returns true when the caller has a `members` row in that tenant with `church_unit` containing `Training Rep` (case-insensitive).
- Update RLS on `lecturer_qc_checks`:
  - **SELECT**: unchanged (any tenant member).
  - **INSERT**: allow tenant admins OR (`is_training_rep_member(auth.uid(), tenant_id)` AND `wofbi_qc_enabled` in `tenants.settings`) AND `created_by = auth.uid()`.
  - **UPDATE**: admins on any row in tenant; Training Rep members only on rows where `created_by = auth.uid()`.
  - **DELETE**: admins only (Training Rep cannot delete).

### Technical notes
- Uniqueness relies on subject being non-null; the app-side validation blocks null subjects, and the unique index prevents races.
- The `is_training_rep_member` helper is used both by RLS and by the client-side toggle in Bible School (via existing `useUnitMembership("Training Rep")` on the frontend — the helper is only needed server-side).
- No changes to `MemberExamsView` for regular members.

### Files touched
- `supabase/migrations/<new>.sql` (schema + policies + helper).
- `src/pages/ExamManagement.jsx` (Training Rep-only view; button/tab gating).
- `src/components/exams/LecturerManager.jsx` (new `wofbi_qc_enabled` toggle).
- `src/components/exams/QcReport.jsx` (button/edit/delete gating).
- `src/components/exams/QcCheckDialog.jsx` (required subject, Training Rep member select, dedupe pre-check).
