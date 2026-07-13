## Why you see two "Blarker Dre" rows

There are two rows in `course_registrations` for the same member (Blarker Dre, `blarkerdre@yahoo.com`) in Demo Church, but they are for **two different courses**:

| Course | Status | Registered |
|---|---|---|
| Leadership Diploma Course (LDC) | `pending` | 14 May 2026 |
| Leadership Certificate Course (LCC) | `approved` | 14 May 2026 (approved 13 Jul 2026) |

Both were created by the **old public-register flow** (before we removed the `course_registrations` insert from `public-wofbi-register`). They are legacy rows — there is **no matching `wofbi_applications` record** for either.

Why they still show as "two applications":
- **Applications tab** merges `wofbi_applications` with any leftover `course_registrations` rows that have no matching application. With zero application rows for this person, both legacy registrations surface as synthetic "direct" entries → looks like two applications.
- **Bible School Management** (per-course list) now filters to `approved/active`, so only the LCC row would appear there under LCC. The LDC pending row is hidden there but still visible in the Applications tab.

The earlier cleanup migration only deleted pending `course_registrations` rows that had a matching `wofbi_applications` row. Blarker has no application rows, so the legacy pending LDC row was not cleaned up.

## Fix

Broaden the legacy cleanup to remove pre-fix `pending` `course_registrations` rows that have no matching `wofbi_applications` row either — these can only have been created by the old public flow, since admin-created rows are inserted as `approved`/`active`.

### Data-only migration
Delete `course_registrations` rows where:
- `status = 'pending'`
- `approved_at IS NULL`
- No `wofbi_applications` row exists for the same `tenant_id + course_id + member_id`

This will remove the stale LDC `pending` row for Blarker Dre (and any other similar legacy leftovers across tenants) without touching approved/active registrations or any admin-created rows.

### Expected result after cleanup
- Applications tab for Demo Church: Blarker Dre appears **once** — as the approved LCC registration (source: direct).
- Bible School Management: unchanged — LCC shows Blarker Dre; LDC shows no one.

## Out of scope
- No code changes. The public-register / approve / Bible School Management logic from the previous fix already prevents new duplicates. This is purely a legacy data cleanup.
