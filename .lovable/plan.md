# Extended Bible School Application Form

Replace the current short registration form with an optional, admin-configurable "long form" that mirrors the paper WOFBI application. Admins can toggle it on/off, edit fields, and view submissions in a new tab.

## Scope

- Public registration (`/t/:tenantSlug/bible-school/register`) shows either:
  - The existing short form (when the long form is OFF), or
  - The full application form (when ON), rendered from a per-tenant field schema.
- Admins in Bible School (`/exam-management`) get:
  - A toggle: "Use detailed application form"
  - A "Form Editor" to add/edit/remove/reorder fields
  - A new tab "Applications" listing submissions (view + export CSV)

## Data model (1 migration)

**New table `wofbi_application_forms`** (one row per tenant, holds schema + toggle)
- `tenant_id` (unique)
- `enabled` boolean default false
- `title` text (default "Word of Faith Bible Institute — Application Form")
- `intro_text` text
- `fields` jsonb — ordered array of field definitions:
  ```
  { id, label, type, required, options?, placeholder?, help_text?, section? }
  ```
  Supported types: `text`, `textarea`, `email`, `tel`, `date`, `select`, `radio`, `checkbox`, `yes_no`, `section_heading`.
- Seeded on first read with fields matching the paper form: Surname, First name, Gender (M/F), DOB, Nationality, Marital status (M/S/O), Address, Post code, Tel, Mobile, Employed (Y/N) + occupation, Academic background, Born again (Y/N) + when + where, Current place of worship, Pastor's address & post code, Pastor name, Present activity group, Previous Bible college info, Coming with children (Y/N) + ages, How heard about (A–E options + friend/graduate name+tel), Declaration name + signature agreement, Consent Y/N.

**New table `wofbi_applications`** (submissions)
- `tenant_id`, `course_id` (FK exam_titles), `member_id` (nullable, linked when member created), `email`, `first_name`, `last_name`, `phone`
- `answers` jsonb — `{ field_id: value }` for every configured field
- `status` text default 'submitted' ('submitted' | 'approved' | 'rejected')
- `reviewed_by`, `reviewed_at`, `notes`

**Grants + RLS**
- Both tables: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role`.
- `wofbi_application_forms`: `GRANT SELECT TO anon` (public form needs schema); read policy: anon+authenticated select where tenant matches; write: admins only via `has_role`/tenant-owner check.
- `wofbi_applications`: no anon; insert via service role in edge function; select/update for admins of the tenant; the submitter's linked member can select their own row.

## Public flow

Update `src/pages/PublicWoFBIRegistration.jsx`:
1. After resolving tenant, fetch `wofbi_application_forms` row.
2. If `enabled=false` → render existing short form (unchanged).
3. If `enabled=true` → render a dynamic form from `fields`, plus course selector and consent. Client-side validation for required fields.
4. On submit, POST to a new/updated edge function.

Update edge function `supabase/functions/public-wofbi-register/index.ts`:
- Accept new payload shape `{ tenant_id, course_id, first_name, last_name, email, phone, answers, gdpr_consent, website }`.
- Same rate limit, honeypot, and tenant resolution as today.
- Server-side validation: iterate the tenant's `fields` schema, ensure required ones present, enforce max length per field, sanitize strings.
- Create/find `members` row (as today), insert `course_registrations` (as today), AND insert `wofbi_applications` row with full `answers`.
- Trigger existing welcome + course registration emails.

## Admin UI

In `src/pages/ExamManagement.jsx`, add:

1. **New tab "Applications"** in the existing Tabs list (alongside current tabs):
   - Table: date, applicant name, email, course, status, actions (View, Approve, Reject).
   - Detail dialog showing all `answers` grouped by section, with links to the linked member.
   - CSV export button.
2. **Under Settings/Course setup area** (or a new "Application Form" section), a card with:
   - Enabled switch (writes `wofbi_application_forms.enabled`).
   - Title + intro text inputs.
   - Field list: drag-to-reorder rows, each with edit dialog (label, type, required, options for select/radio, help text, section grouping). Add / delete field buttons.
   - "Reset to WOFBI default" button.
   - Preview button that renders the current schema in a dialog.

All changes tenant-scoped via `useTenantQuery` and guarded by `isAdmin || isTenantAdmin`.

## Non-goals

- No PDF upload of the paper form (fields are captured digitally).
- No payment/tuition tracking (kept out per project scope — financial tracking excluded).
- No changes to exam-taking, grading, certificates, or the existing member/registration linking model.

## Files

**New**
- `supabase/migrations/<ts>_wofbi_application_form.sql`
- `src/components/exams/WoFBIApplicationFormEditor.jsx`
- `src/components/exams/WoFBIApplicationsTab.jsx`
- `src/components/exams/WoFBIDynamicForm.jsx` (renderer used by public page and preview)

**Edited**
- `src/pages/PublicWoFBIRegistration.jsx` (branch on `enabled`)
- `src/pages/ExamManagement.jsx` (new tab + form editor entry point)
- `supabase/functions/public-wofbi-register/index.ts` (accept `answers`, insert application)
- `src/integrations/supabase/types.ts` (regenerated after migration)

Approve to proceed and I'll build in this order: migration → edge function → public renderer → admin editor + applications tab.
