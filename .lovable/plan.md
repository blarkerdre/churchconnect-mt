
# Authenticated Responsive Sweep

## Goal
Capture authenticated routes at 375, 414, 768, and 1280 px, then fix common responsive issues surfaced.

## Blocker
`LOVABLE_BROWSER_AUTH_STATUS=signed_out` — no Supabase session is injected, so Playwright can't reach authenticated routes. Need the user to sign in on the preview so a session mints on the next message.

## Fallback (if session keeps not injecting)
Static audit: read authenticated pages/dialogs and fix responsive issues from the code without screenshots. Less thorough but still useful.

## Steps (once session available)

1. **Playwright sweep** with the injected session, screenshots under `/tmp/browser/audit-auth/<viewport>/<route>.png`.
   Routes: Dashboard, Members (+ form, bulk import), Events (+ form, registrations), Pastoral Care (+ form, request), Transportation (+ booking, report), Communications (announcement, direct send, history, bulk), Follow-ups (+ form, report, signpost), Bible School (Applications, Registrations, Attendance, QC, Rate Lecturer, Take Exam), Teens Attendance (+ registered teens, cumulative report), Children's Church, Church Attendance, Unit Tasks, Inventory, Sermon Notes, Testimony, Settings, User Management, Tenant Admin, Reports, Analytics, Training Reports, System Logs.

2. **Dense dialogs** opened at 375 + 1280: member, event, WOFBI, transport booking, WSF centre, QC, rate lecturer, session, inspection, signpost, follow-up, invoice editor, bulk assign, sermon note.

3. **Fix as encountered** (presentation only): overflow, dialog scrolling, non-responsive grids, squishing buttons, long text truncation, bottom-nav overlap, remaining hardcoded colors → semantic tokens.

## Out of scope
Redesigns, new features, business logic, deep a11y, print, dark-mode-only issues, table→card rewrites.

## Deliverable
Summary grouped by page/component listing what changed, plus any deferred issues.
