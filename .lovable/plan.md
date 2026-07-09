# Lecturer Rating for Bible School

## Goal
Bible School students can rate lecturers using the WoFBI "Rate the Lecturer" form. Admins can toggle the feature on/off and manage the list of lecturers.

## Database (new migration)

**`lecturers`** — admin-managed list per tenant
- `id uuid pk`, `tenant_id uuid` (fk tenants), `name text`, `level text null` (e.g. "BFC/BCC/LCC/LDC"), `active bool default true`, `created_at`, `updated_at`
- RLS: authenticated users of tenant can SELECT; only admins (has_role admin/super_admin OR tenant owner/admin) can INSERT/UPDATE/DELETE. Scoped by `tenant_id`.
- Grants: SELECT/INSERT/UPDATE/DELETE to authenticated; ALL to service_role.

**`lecturer_ratings`** — student submissions
- `id uuid pk`, `tenant_id uuid`, `lecturer_id uuid` (fk lecturers on delete cascade), `member_id uuid` (fk members), `submitted_by uuid` (auth user)
- Question fields matching form:
  - `session_description text` — one of: preaching / teaching / impartation / all / none
  - `delivery text` — clear_simple / interactive / just_right / not_clear / difficult
  - `time_keeping text` — on_time / too_long / too_short / just_right / not_sure
  - `class_atmosphere text` — in_control / unable_to_control / balance_right / not_sure
  - `test_quality text` — too_hard / too_simple / just_right / not_sure
  - `have_again text` — yes / no / maybe / never / unsure
  - `overall_rating int` (1-10)
  - `comments text null`
- `created_at timestamptz default now()`
- Unique `(tenant_id, lecturer_id, member_id)` so a student rates a given lecturer once (edit allowed via update).
- RLS:
  - Student INSERT/UPDATE own row where `submitted_by = auth.uid()` and tenant matches.
  - Student SELECT own rows.
  - Admin SELECT all rows in tenant (to view aggregated feedback).
- Grants for authenticated + service_role.

## Feature toggle

Stored in `tenants.settings.wofbi_lecturer_rating_enabled` (boolean, default false). No new global flag — this is a Bible School sub-feature configured by tenant admin from ExamManagement course settings area (existing pattern: an admin-only card with a Switch).

## UI

### 1. Admin — Manage Lecturers & Toggle
In `src/pages/ExamManagement.jsx` (admin section, alongside existing course cards), add a new panel **"Lecturer Feedback"**:
- Toggle switch: "Enable lecturer rating for students" → updates `tenants.settings.wofbi_lecturer_rating_enabled` via existing tenants update pattern.
- Lecturer list table with columns: Name, Level, Active, Actions (Edit / Delete).
- "Add Lecturer" button opens a small dialog (name + optional level).
- Edit dialog reuses same form. Delete uses `DangerConfirmDialog`.
- All queries/mutations tenant-scoped (`.eq("tenant_id", tenantId)`) and log via `logAudit` (`lecturer_create`, `lecturer_update`, `lecturer_delete`, `wofbi_rating_toggle`).

New file: `src/components/exams/LecturerManager.jsx` — encapsulates toggle + CRUD table + add/edit dialog.

### 2. Student — Rate a Lecturer
New file: `src/components/exams/RateLecturerDialog.jsx` — renders the form matching the uploaded image:
- Lecturer dropdown (only `active = true` lecturers in tenant).
- Level free-text input (prefilled if lecturer has default level).
- Q1–Q6 rendered as radio groups with labelled options.
- Q7 rating 1–10 as clickable pill/number buttons.
- Optional comments textarea.
- Footer note: "All information will be treated confidentially under GDPR."
- Submit calls upsert on `lecturer_ratings` keyed by `(tenant_id, lecturer_id, member_id)` so re-submission edits their prior rating.

Entry point for students: in the Bible School student view of `ExamManagement.jsx` (the block visible to non-admins with `myMember`), add a "Rate a Lecturer" button — only rendered when `tenants.settings.wofbi_lecturer_rating_enabled === true` AND at least one active lecturer exists. Button opens `RateLecturerDialog`.

### 3. Admin — View Ratings
Add a "View Feedback" button per lecturer in `LecturerManager` opening a dialog listing submitted ratings for that lecturer (member name, date, all answers, overall rating, comments). Read-only. Uses tenant-scoped query.

## Scope guardrails
- Frontend + one migration. No changes to grading, certificates, or existing exam flow.
- All DB calls include explicit `.eq("tenant_id", tenantId)`.
- Feature hidden entirely when toggle is off (student never sees the button; admin still sees management panel to configure).
- No public/anonymous submission — student must be authenticated and have a `members` row (uses `myMember.id`).

## Files
- **New** `supabase migrations` — `lecturers`, `lecturer_ratings` tables + RLS + grants.
- **New** `src/components/exams/LecturerManager.jsx` — admin toggle + CRUD + feedback viewer.
- **New** `src/components/exams/RateLecturerDialog.jsx` — student rating form.
- **Edit** `src/pages/ExamManagement.jsx` — mount `LecturerManager` in admin area; add "Rate a Lecturer" button in student area gated by toggle.
