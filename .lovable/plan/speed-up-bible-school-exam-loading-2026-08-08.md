# Speed up Bible School (exam) loading

## What I found

Two separate causes for the long spinner, both confirmed by reading the code and the database.

**1. The Bible School page is one giant bundle.** `src/pages/ExamManagement.jsx` is 2,205 lines and statically imports every tab up front — Applications, Students report, Attendance, Sessions, Application Form editor, Feedback Form editor, Lecturer Feedback, Quality Control and Course Report (~13,000 lines of component code in total), plus the QR-code library and the Word/`.docx` generator (JSZip) used by the Course Report. All of that has to download and parse before anything at all appears, even though only one tab is visible at a time.

**2. Common queries have no matching index.** From the database's own slow-query stats:
- Loading the notifications list averages 13ms but peaks at 5.4 seconds (77k calls) — `notifications` has no index on `(user_id, tenant_id, created_at)`.
- Loading the member list averages 45ms and peaks at 5.6 seconds — `members` has no index on `(tenant_id, created_at)`.
- The "who am I" member lookup peaks at 5.1 seconds under load.

These run on every page including Bible School, so they stack onto the spinner.

For taking an exam specifically, the questions themselves load through a single fast RPC — the delay there is the same page bundle plus a cold start of the grading function on submit.

## What I'll change

### Split the page so only the visible tab loads
- Convert each heavy tab in `ExamManagement.jsx` to a lazily loaded component, rendered inside a small `Suspense` fallback so the tab shows a light skeleton instead of blocking the whole page.
- Keep the Management tab (the default view) eager so the first paint is immediate.
- Lazy-load the `.docx`/JSZip generator only when someone actually clicks "Word (.docx)" in the Course Report, and the QR dialog only when opened.

### Add the missing database indexes
- `notifications (user_id, tenant_id, created_at DESC)`
- `members (tenant_id, created_at DESC)`
- `course_registrations (tenant_id, course_id, session_id)` for the registration lists the Bible School tabs load.

### Trim redundant refetching
- The page fires roughly 20 queries on mount, several of which duplicate the same `app_settings` key. Deduplicate those to one shared query and give the slow-changing lookups (courses, subjects, sessions, settings) a longer cache window so switching tabs does not refetch them.

## Notes

- No behaviour or wording changes — same features, same data, just loaded on demand.
- Indexes are added through a migration; they do not change any access rules.
- If the app still feels slow after this under real traffic, the next lever is increasing the size of the Lovable Cloud instance, but I'd measure again first.
