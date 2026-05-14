## Goal

Rebuild `ChurchManagementSuite_UserGuide_Comprehensive.pdf` so each chapter is illustrated with **real screenshots captured from the Demo Church (TEST) tenant** in the live preview, instead of drawn mockups.

Output: `/mnt/documents/ChurchManagementSuite_UserGuide_Comprehensive_v3.pdf` (keeps v1/v2 intact).

## Required from you

Demo Church login credentials I can use in the preview browser:

- Admin/Tenant Owner email + password (covers Admin + Leader chapters)
- Optional: a regular Member email + password (for member-only screens like self check-in, my profile, sermon notes)

If you only provide an admin login, I'll capture admin-view screens for member chapters too and label them clearly. I will not use real-user screens you haven't authorised.

## Capture plan (Demo Church (TEST), `/t/demo-test`)

Browser session at 1366×768 desktop + 390×844 mobile where relevant. For each route below: navigate, wait for data, screenshot, crop to the relevant panel.

| Chapter | Route | Shots |
|---|---|---|
| Sign in / branding | `/t/demo-test/auth` | login page |
| Dashboard & Feed | `/t/demo-test/dashboard` | feed, slideshow, KPI tiles |
| Profile | `/t/demo-test/profile` | profile page |
| Members directory | `/t/demo-test/members` | list + 1 member detail dialog |
| Events | `/t/demo-test/events` | list + event detail + check-in |
| Attendance | `/t/demo-test/attendance` | sessions list + report |
| Pastoral Care | `/t/demo-test/pastoral-care` | queue + case detail |
| Transportation | `/t/demo-test/transportation` | bookings + assignment |
| Testimonies | `/t/demo-test/testimonies` | list + detail |
| Sermon Notes | `/t/demo-test/sermon-notes` | folders + editor |
| Bible School | `/t/demo-test/bible-school` | course list + registrations |
| Home Cell | `/t/demo-test/home-cell` | centres + meeting attendance |
| Church Units | `/t/demo-test/units` | units grid + unit detail |
| Follow-ups | `/t/demo-test/followups` | queue + form |
| Communications | `/t/demo-test/communications` | composer + history |
| Analytics | `/t/demo-test/analytics` | KPI + charts + member reports |
| Training Reports | `/t/demo-test/training-reports` | report screen |
| Settings | `/t/demo-test/settings` | tabs |
| Audit Logs | `/t/demo-test/audit-logs` | log table |
| Danger Zone | `/t/demo-test/danger-zone` | screen (no destructive clicks) |
| Mobile views | same routes @ 390×844 | dashboard, check-in, sermon notes |

Approx 35–45 screenshots saved to `/tmp/guide-shots/*.png`.

## Privacy & safety

- Demo Church only — never the live WCI Cardiff tenant.
- Light blur over visible email addresses, phone numbers and photos using Pillow before embedding.
- No destructive clicks: Danger Zone, Delete, Send broadcast, etc. are screenshotted at rest only.
- Each screenshot framed in a thin navy border with a small "Demo Church (TEST)" caption underneath so it's obvious the data is illustrative.

## PDF build

- Reuse the existing `reportlab` document (same DomiFort Navy/Gold branding, Playfair-style headings, Source Sans body, running header/footer, role chips, step blocks, callouts).
- Replace each chapter's drawn `DesktopFrame` / `MobileFrame` flowable with an `Image` flowable pointing at the captured PNG, wrapped in a rounded card with caption.
- Auto-scale each image to page width while preserving aspect ratio; long screens get split across two figures rather than shrunk illegibly.
- Cover page updated to: "Illustrated with live screenshots from Demo Church (TEST), captured <today>."
- Estimated 45–55 pages.

## QA

`pdftoppm -jpeg -r 110 output.pdf qa/page` then visually inspect every page for: clipped images, unreadable text, overflow, blank pages, missing screenshots, residual unmasked PII. Fix and re-render until a full pass is clean. QA images discarded.

## Out of scope

- No structural rewrite of chapters; only mockups → real screenshots.
- No new feature documentation.
- No screenshots from any tenant other than Demo Church (TEST).

## What I need from you to proceed

Please paste the Demo Church admin login (and optional member login) in chat. Once received I'll start capturing and building.
