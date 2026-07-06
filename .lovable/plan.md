## Goal

Adopt the uploaded Word of Faith Bible Institute certificate as the default Bible School certificate design, and issue every Bible School completion a structured "Student No." in the format `WCIC/BCC/AUGUST/2025/113`.

## 1. Data model changes (migration)

Add three new fields, all editable in existing admin UIs:

- `tenants.certificate_code TEXT` — short prefix (e.g. `WCIC`). Falls back to the tenant slug uppercased when empty.
- `exam_titles.course_code TEXT` — short course code (e.g. `BCC`, `LCC`, `LDC`, `BFC`). Required for Bible School courses.
- `training_completions.student_number TEXT` — the structured number (`WCIC/BCC/AUGUST/2025/113`). Kept separate from the existing `certificate_number` so historical certificates aren't disturbed.

No RLS changes needed (fields inherit existing table policies).

## 2. Student-number generation

New Postgres function `public.next_student_number(_tenant_id uuid, _course_id uuid, _completion_date date)` — SECURITY DEFINER, `search_path = public`:

1. Read `certificate_code` from tenants (fallback: `upper(slug)`).
2. Read `course_code` from `exam_titles` (fallback: first letters of course name).
3. Compute `MONTH = to_char(_completion_date, 'FMMONTH')` (e.g. `AUGUST`) and `YEAR = to_char(_completion_date, 'YYYY')`.
4. Count existing `training_completions` for the same tenant + course where `student_number LIKE '<prefix>/<course>/<MONTH>/<YEAR>/%'`, add 1, zero-pad to 3 digits.
5. Return `WCIC/BCC/AUGUST/2025/113`.

Called from the `issue-certificate` edge function whenever the completion is for a Bible School course (i.e. `training_type` matches a `exam_titles.name` for that tenant). Non-Bible-School completions continue to use the current `CERT-...` scheme untouched.

Preview mode returns `WCIC/BCC/AUGUST/2025/PREVIEW`.

## 3. Certificate visual (matches upload)

Update `issue-certificate/index.ts` SVG to a new "Bible School" layout used when the course belongs to `exam_titles`:

- Landscape A4 (existing 842×595) on white.
- Title in a red script face ("The Word of Faith Bible Institute, Cardiff") — configurable via `certificate_templates.church_name`. Load a script TTF (Great Vibes or Allura) via the existing Google Fonts loader.
- Sub-line: `This is to certify that` (dark red).
- Student name — large, bold, purple (`#5B2E91`), configurable colour.
- `Student No.  WCIC/BCC/AUGUST/2025/113` — italic serif.
- `has fulfilled the requirement of the institute for the`
- Course name in large black script (Monotype-Corsiva-ish; reuse the script font).
- `with` and grade classification (from `training_completions.grade` / classification, red).
- Dean signature image + label (left), crest image (centre), date (right, italic serif).

All colours, church name, signatory name/title, dean-signature image, and crest image remain editable in **Certificate Template Settings** (`certificate_templates`). Ship this as the seeded default when a tenant's Bible School template is missing.

New optional columns on `certificate_templates` (added in the same migration):

- `dean_signature_url TEXT`
- `crest_image_url TEXT`
- `script_font_url TEXT` (optional override; sensible Google Fonts default)

## 4. UI changes

- **Tenant Admin → Settings**: add "Certificate code" input on the tenant form (short text, uppercase-hint, max 8 chars).
- **Exam Management → course editor** (`exam_titles`): add "Course code" input next to name (e.g. `BCC`). Show validation warning if missing.
- **Certificate Template Settings** (`CertificateTemplateSettings.jsx`): add uploaders for Dean signature and Crest image (reuse existing storage helpers), plus a colour picker for the "Name colour" (purple by default).
- **My Certificates** (`MyCertificates.jsx`) and **Certificate Approvals / Report** pages: show `student_number` instead of / alongside `certificate_number` for Bible School completions.
- **Issue Certificate dialog** (`IssueCertificateDialog.jsx`): preview reflects the new layout; shows the student number that will be assigned.

## 5. Backfill (optional, one-off)

Provide a small admin action ("Backfill student numbers") on the Certificates Report page that, for each existing Bible School `training_completions` row without a `student_number`, generates one ordered by `completion_date` using the same function. Idempotent (skips rows that already have one).

## 6. QA

- Migration applies cleanly; grants unchanged (existing tables).
- Issue a preview certificate for a Bible School course → verify layout matches upload and preview number shows `.../PREVIEW`.
- Issue a real certificate → number equals `<TENANT>/<COURSE>/<MONTH>/<YEAR>/001`; second issue in same month = `/002`; new month resets to `/001`.
- Issue a non-Bible-School training completion → falls back to old `CERT-...` design, unchanged.
- Downloaded PNG in "My Certificates" opens correctly.

## Out of scope

- Changing existing `certificate_number` values.
- Public verification page for student numbers (can be a follow-up).
- Financial/fees on the certificate.
