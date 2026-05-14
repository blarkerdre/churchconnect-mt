## Credentials received

- Admin: `kugbiyiadeniyi@gmail.com` / `adminadmin`
- No member-only login provided — will capture member-facing screens from the admin session and label them clearly.

## Execution (re-confirmed from previous approved plan)

1. **Browser session**
   - Navigate to `/t/demo-test/auth` at 1366×768.
   - Sign in with the admin credentials above.
   - Verify landing on Demo Church (TEST) dashboard.

2. **Capture screenshots** (~35–45 PNGs to `/tmp/guide-shots/`)
   - Desktop: dashboard, members, events, attendance, pastoral care, transportation, testimonies, sermon notes, bible school, home cell, units, follow-ups, communications, analytics, training reports, settings, audit logs, danger zone.
   - Mobile (390×844): dashboard, self check-in, sermon notes editor, profile.
   - Detail dialogs opened where useful (member detail, event detail, pastoral case).
   - No destructive clicks (Send / Delete / Purge).

3. **Privacy pass** (Pillow)
   - Blur visible emails, phone numbers, and avatar photos in each PNG.
   - Add 1px navy border + "Demo Church (TEST) — illustrative" caption strip.

4. **Rebuild PDF** (`reportlab`)
   - Same DomiFort branding, structure, role chips, step blocks, callouts.
   - Replace each chapter's drawn mockup with the corresponding captured PNG, scaled to page width.
   - Cover updated: "Illustrated with screenshots from Demo Church (TEST), captured <today>."
   - Output: `/mnt/documents/ChurchManagementSuite_UserGuide_Comprehensive_v3.pdf`.

5. **QA**
   - `pdftoppm -jpeg -r 110` every page; visually inspect for clipping, overflow, blank pages, missed PII.
   - Iterate until clean. Discard QA images.

6. **Deliver** the v3 PDF as a `<presentation-artifact>`.

Ready to switch to build mode and execute.
