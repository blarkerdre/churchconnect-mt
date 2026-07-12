# Unify Bible School Applications & Registrations

## Problem
Romoke appears under a course's **Registrations** (she has a `course_registrations` row, approved) but not under the top-level **Applications** tab (no `wofbi_applications` row). The two lists come from different tables, so anyone enrolled directly (admin add, internal flow) is invisible in Applications.

## Fix — UI only, no schema changes

Extend the **Applications tab** (`src/components/exams/WoFBIApplicationsTab.jsx`) so it lists a unified feed of Bible School applicants from both sources:

1. **Two queries in parallel, merged in memory:**
   - Existing `wofbi_applications` query (unchanged).
   - New query on `course_registrations` joined with `members` and `exam_titles`, tenant-scoped.
2. **Merge logic:** for every `course_registrations` row, check if a `wofbi_applications` row already exists for the same `(member_id, course_id)`. If yes → skip (the application row wins). If no → synthesize a display-only row:
   ```
   { id: `reg:${registration.id}`, source: "direct",
     first_name, last_name, email, phone (from members),
     course: exam_titles row, status: registration.status,
     answers: {}, created_at: registration.registered_at }
   ```
3. **UI adjustments:**
   - Add a small **Source** badge column: "Application form" vs "Direct enrolment".
   - Add a **Source** filter (all / form / direct) alongside status/course filters.
   - Existing search, date, course, status filters keep working since synthetic rows use the same shape.
   - Report tallies naturally include both.
4. **Row actions on synthetic (direct) rows:**
   - **View detail** → opens a simplified dialog showing member + course + registration status (no answers section).
   - **Approve / Reject** buttons → update `course_registrations.status` instead of `wofbi_applications.status`. If admin wants a full application record they can still use the app form; no auto-creation.
   - **Delete** → routes to the existing `cascade_delete_bible_school_records` RPC (already handles linked members).
   - Bulk-select works the same; the mutation branches by `source`.
5. **Tab count** in `TabsTrigger` header shows the merged total.

## Files touched
- `src/components/exams/WoFBIApplicationsTab.jsx` — add second query, merge, source badge/filter, action branching.

## Out of scope
- No DB migration, no trigger, no backfill of `wofbi_applications` rows.
- Per-course Registrations view inside Management stays as-is (it's the drill-down).
- Romoke's data won't change; she'll simply now show up in Applications tagged "Direct enrolment — approved".
