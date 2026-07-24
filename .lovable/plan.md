
# Authenticated Responsive Sweep

## Goal
Now that a session is available, capture authenticated routes at 375, 414, 768, and 1280 px, then fix the common responsive issues surfaced.

## Steps

1. **Playwright sweep** using the injected Supabase session. Screenshots stored under `/tmp/browser/audit-auth/<viewport>/<route>.png` and reviewed with `code--view`.

   Routes:
   - Dashboard, Members (+ form, bulk import), Events (+ form, registrations)
   - Pastoral Care (+ form, request), Transportation (+ booking, report)
   - Communications (announcement, direct send, history, bulk)
   - Follow-ups (+ form, report, signpost)
   - Bible School: Applications, Registrations, Attendance, QC, Rate Lecturer, Take Exam
   - Teens Attendance (+ registered teens, cumulative report), Children's Church
   - Church Attendance, Unit Tasks, Inventory, Sermon Notes, Testimony
   - Settings (all sections), User Management, Tenant Admin, Reports, Analytics, Training Reports, System Logs

2. **Open dense dialogs** at 375 + 1280: member, event, WOFBI, transport booking, WSF centre, QC, rate lecturer, session, inspection, signpost, follow-up, invoice editor, bulk assign, sermon note.

3. **Fix as encountered** (presentation layer only):
   - Horizontal overflow, missing `overflow-x-auto` on tables/tab strips
   - Dialogs without `max-h-[90vh] overflow-y-auto` or with clipped footers
   - Grids without responsive prefixes (`grid-cols-3` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)
   - Buttons squishing (add `shrink-0`, `flex-col sm:flex-row`)
   - Long text without `truncate`/`break-all`
   - Bottom-nav overlap (`pb-20 lg:pb-0`)
   - Remaining hardcoded colors → semantic tokens

## Out of scope
Redesigns, new features, business logic, deep a11y, print layouts, dark-mode-only issues, table→card rewrites.

## Deliverable
Summary grouped by page/component with what changed, plus list of any deferred issues.
