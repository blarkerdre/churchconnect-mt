# Responsive Audit + Fix Pass

## Goal
Visit the app's key pages at 375, 414, 768, and 1280 CSS px, screenshot each, identify common responsive problems, and fix them in a single pass.

## Approach

### 1. Automated screenshot sweep (Playwright)
Sign in as an admin via the injected session and capture every major route at all four viewports. Screenshots saved under `/tmp/browser/audit/<viewport>/<route>.png`, then reviewed with `code--view`.

Routes covered (representative, not exhaustive):
- Dashboard, Members, Member form, Bulk Import
- Events + Event form + Registrations dialog
- Pastoral Care + form + request dialog
- Transportation + booking dialog + report
- Communications (Announcement, Direct Send, History, Bulk)
- Follow-ups + form + report + signpost
- Bible School: Applications, Registrations, Attendance, QC dialog, Rate Lecturer, Take Exam
- Teens: Attendance, Checkin landing, Registered Teens dialog, Cumulative Report
- Children's Church
- Church Attendance, Unit Tasks, Inventory, Sermon Notes, Testimony
- Settings (all sections), User Management, Tenant Admin
- Reports Hub, Analytics, Training Reports, Audit Log, System Logs
- Auth, Public Registration, Public WoFBI Registration, Onboard, Landing

Open the top ~15 dialogs (member, event, WOFBI form, transport booking, WSF centre, QC check, rate lecturer, session, inspection, signpost, follow-up, invoice editor, bulk assign, MFA, sermon note) at 375px + 1280px specifically since those are the densest UI.

### 2. Common issues to fix as they appear
- Horizontal overflow on mobile (fixed widths, `whitespace-nowrap` where wrapping is fine, long emails/URLs without `break-all`)
- Dialogs missing `max-h-[90vh] overflow-y-auto` or with footer buttons hidden below fold
- Grids that don't collapse (`grid-cols-3` without `sm:`/`md:` prefix at narrow widths)
- Tables that need `overflow-x-auto` wrappers or a mobile card fallback
- Buttons squishing / icon-only regressions on small screens (add `shrink-0`, wrap in flex-col at `sm:flex-row`)
- Fixed `min-w-*` inputs blowing out cards on 360px
- Bottom-nav overlap: pages missing `pb-20 lg:pb-0` above `MobileBottomNav`
- Text truncation: long member/tenant names without `truncate` + tooltip
- Tab strips overflowing — add `overflow-x-auto` scroll
- Sticky headers overlapping content on small viewports
- Hardcoded color classes (`text-white`, `bg-[#1e3a5f]`) replaced with semantic tokens when spotted (e.g. TransportBookingDialog, WSFCentreFormDialog buttons)

### 3. Out of scope for this pass
- Redesigns, new features, or business-logic changes
- Deep accessibility audit (contrast/ARIA) beyond obvious hit-target sizing
- Print-layout tweaks
- Rewriting tables into mobile-first cards where the existing pattern works
- Dark-mode-only issues (unless spotted incidentally)

### 4. Deliverable
- Chat summary grouped by page/component listing what was broken and what changed
- Before/after screenshot references for the most severe fixes
- List of any issues intentionally deferred (with reason) so you can queue follow-ups

## Technical notes
- Uses the pre-injected Supabase session (`LOVABLE_BROWSER_AUTH_STATUS=injected`) to reach authenticated routes
- Viewport heights kept at 1800px so no `full_page` screenshots are needed
- Each route capture is idempotent; the script can be re-run after fixes to verify
- Fixes prefer Tailwind responsive prefixes over new CSS; touches only presentation files (`src/components/**`, `src/pages/**`, occasional `index.css`)
- No DB migrations, no edge-function changes, no dependency installs
