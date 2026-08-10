# Full audit logging across every module

Today only about 20 tables have audit coverage (members, roles, attendance, pastoral care, transportation, tenants, child check-ins and a handful of Bible School actions), plus scattered manual logging in ~20 screens. Everything else — events, follow-ups, documents, inventory, testimonies, sermon notes, Home Cell, teens/preteens records, Bible School applications/registrations/exams/certificates/QC, unit tasks, settings, billing, GDPR requests — leaves no trail.

This adds automatic, database-level logging of every create, edit and delete across the app, so nothing can slip through regardless of which screen, QR flow or background job made the change.

## What gets logged

For every change: who did it (or "System" for automated jobs), when, which module and record, and a field-by-field before → after list.

Covered modules (added on top of what already exists):

- Members extras: child guardians, pickup delegations, consent events, claim invites, contacts
- Events, registrations, announcements, testimonies, sermon notes and folders
- Follow-ups, referrals and updates, first timers, call log
- Church units, unit tasks, groups, assignments and comments, unit join requests, leader assignments
- Home Cell centres, zones and reports; church attendance reports
- Teens and preteens records, self-enrolments; children records
- Bible School: applications, registrations, courses, subjects, lecturers, exam titles/sessions/questions/attempts, QC checks, lecturer ratings, feedback forms and responses, course reports, certificates and completions
- Inventory items, categories, checklists, inspections
- Documents, training records and reports, driver availability, pickup locations
- Settings and configuration: app settings, feature toggles, certificate templates, message templates, birthday settings, retention policies, API keys, integrations, Trustpilot settings and reviews
- Tenant administration: tenants, memberships, invitations, subscriptions, plans, invoices, payments, SLA templates and signatures
- GDPR: data export requests, erasure requests, suppressed emails, unsubscribe activity

Deliberately excluded to keep the trail readable (they are already visible in their own log screens): notifications, email/SMS send logs and queues, scheduled messages, push subscriptions, rate-limit rows, usage counters, ingest logs and the audit log itself.

## Where it appears

System Logs → Audit, using the existing actor, date range, entity filter, expandable before/after diff and CSV export. Two additions:

- A **Module** filter (Members, Events, Bible School, Attendance, Tasks, Settings, Billing, GDPR, etc.) so the much larger volume stays browsable.
- Plain-English labels and prettified field names for all the newly covered tables, with a sensible generic fallback ("updated Event Registration") so a future table never renders as raw SQL names.

## Technical notes

- One shared `SECURITY DEFINER` trigger function `public.audit_row_change()` (`SET search_path = public`), attached `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` to each covered table. Existing bespoke triggers stay as they are — no double logging, the new function is only attached to tables that have none.
- Writes one `audit_log` row: `tenant_id` from the row (falls back to a lookup on the parent record for child tables that lack the column), `user_id = auth.uid()` (null → rendered as "System"), `action` = `<table>_create|update|delete`, `entity_type` = table name, `entity_id` = row id.
- `details` = `{ module, action, label, before, after }`. `before`/`after` are the row minus noise columns (`updated_at`, `search_vector`-style derived fields) and minus sensitive values (PIN hashes, tokens, API keys, exam answer keys are recorded as `"[redacted]"`). Updates with no meaningful diff are skipped.
- A small `public.audit_module_for_table()` mapping keeps module names and human labels in one place, mirrored client-side in `src/pages/SystemLogs.jsx`.
- Client changes limited to `src/pages/SystemLogs.jsx` (module filter, label map, field prettifier, generic fallback). Existing `logAudit()` calls for non-database actions (bulk sends, exports, downloads) stay untouched.
- `audit_log` already blocks updates and deletes, so the trail remains tamper-evident. RLS and grants on covered tables are unchanged.
- Applied in a single migration; row counts grow, so the audit tab keeps its date-range default of the recent window and paginates.
