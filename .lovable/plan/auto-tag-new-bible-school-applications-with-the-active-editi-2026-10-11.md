# Auto-tag new Bible School applications with the active edition

## Cause (confirmed)

New applications already go through an automatic edition-tagging step. That step fails for two reasons:
- It only matches an edition when the application date falls inside the edition's start and end dates.
- Its backup check looks for editions marked "open". Your editions are marked "active", so the backup never finds one.

As a result, an application for a course in an active edition (like Test 2026) is saved as "Unassigned edition". Registrations already check for "active", so they are tagged correctly.

## Fix

- Change the backup check to treat "active" (and "open") as a live edition, matched case-insensitively.
- If one edition is live for that course, new applications get that edition, even without set dates.
- If several editions are live, use the one that started most recently.
- Apply the same rule to new Bible School attendance sessions, lecturer quality checks, lecturer ratings and feedback responses.
- Tag existing unassigned applications that were submitted while a live edition was running for their course. Adeniyi's application will then appear under Test 2026.

Applications you assigned yourself keep their edition. No screen changes.

## Technical notes

- Migration: `CREATE OR REPLACE` on `resolve_exam_session_for_course` so that, when `_on_date IS NULL`, it matches `lower(s.status) IN ('active','open')`, ordered by `started_at DESC NULLS LAST, starts_on DESC NULLS LAST, created_at DESC`. Keep the date-range branch unchanged.
- Backfill in the same migration: `UPDATE wofbi_applications SET session_id = resolve_exam_session_for_course(tenant_id, course_id, NULL) WHERE session_id IS NULL AND course_id IS NOT NULL`, only for rows where a live edition is found.
- `stamp_wofbi_session_id` trigger needs no change. It already falls back to the resolver.
