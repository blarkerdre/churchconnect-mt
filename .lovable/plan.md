## Full responsive sweep — approved scope A

### Phase 1 — Capture
Playwright against local preview, authenticated via injected session. Screenshot every route below at three viewports (384×800 mobile, 768×1024 tablet, 1280×900 desktop). Save under `/tmp/browser/responsive/<route>/<viewport>.png`.

Routes:
- Dashboard, Members, Communications, Events, Pastoral Care, Transportation
- Attendance, Church Attendance, Teens Attendance, Children Church
- Home Cell (WSF), Bible School (Exam Management), Follow-ups, Unit Tasks
- Inventory, Sermon Notes, Testimony, Analytics, Reports
- My Profile, My Family, My Data, Settings, User Management
- Tenant Admin, Audit Log, System Logs
- Public: `/`, `/auth`, public registration, teens check-in landing

### Phase 2 — Dialog audit at 384px
Open and screenshot the highest-risk dialogs:
MemberFormDialog, EventFormDialog, TeensSection add/edit, WoFBI Application Form Editor, QcCheckDialog, RateLecturerDialog, TakeExamDialog, SessionFormDialog, TransportBookingDialog, PastoralCareFormDialog, FollowupFormDialog, SermonNoteFormDialog, CertificateTemplateSettings, BulkImportDialog, TenantUsersDialog, ReportDialog variants, CumulativeReportDialog.

### Phase 3 — Fix by category (not by page)
Group findings and fix the pattern once across all offenders:
- Horizontal overflow → `min-w-0`, `flex-wrap`, `overflow-x-auto`, responsive grid
- Dialogs > viewport height → `max-h-[90vh] overflow-y-auto`, sticky header/footer
- Wide tables → scroll container on mobile, stacked-card fallback where already patterned
- Tab bars overflowing → `overflow-x-auto whitespace-nowrap`
- Button/badge crowding → `shrink-0` + `truncate` on siblings
- Mobile bottom-nav collision → `pb-20 lg:pb-6` on page shells missing it
- Any hardcoded colors surfaced during sweep (`text-white`, `bg-black`, hex) → semantic tokens

Frontend/presentation only. No schema, RLS, business logic, or redesigns.

### Phase 4 — Verify
Re-screenshot each previously-broken screen at all three viewports. Report a per-file changelog and any residual issues that need product decisions.

### Deliverable
- List of files changed grouped by fix category
- Before/after screenshots for the top offenders
- Residual issues (if any) flagged for follow-up
