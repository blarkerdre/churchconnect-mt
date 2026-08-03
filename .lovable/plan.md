# Downloadable Attendance Roster

Add a proper "Roster" download — a completed attendance list showing every eligible person with their Present/Absent status and check-in time — available as both a print-ready PDF and a CSV, in two places: Unit/Church attendance sessions and Bible School attendance.

## What the roster contains

Header block with organisation branding, session title, type, date, unit/course, and status, plus summary counts (total, present, absent, rate). Then a numbered table:

| # | Name | Unit / Student no. | Status | Check-in time | Check-out / Method |

Crucially it lists **everyone eligible**, not just those who checked in — absentees appear with an "Absent" row, which today's exports don't do on the church side.

## Where it appears

**1. Unit / Church attendance (Attendance page)**
- A single "Roster" split button next to the existing Download/Print buttons, offering "Download PDF" and "Download CSV".
- Roster is built from the eligible member list for the session (unit-filtered for Unit Meetings, same rule the check-in panel already uses) joined with that session's check-in records.
- The existing plain-text Download and Print buttons stay as they are.

**2. Bible School attendance (Bible School → Attendance tab)**
- Two roster modes, chosen in a small dialog:
  - **Per-session roster** — one chosen session, every registered student marked Present / Late / Absent with times.
  - **Course summary roster** — all students across all sessions (this is what today's "Export CSV" gives), now also available as PDF.
- Adds PDF output alongside the existing CSV, and adds the currently missing per-session roster.

## Technical notes

- New shared helper `src/lib/attendance-roster.js` with `buildRosterCsv(roster)` and `openRosterPrint(roster)`, taking a normalised `{ title, meta[], summary[], headers[], rows[] }` object so both modules produce identical-looking output.
- PDF uses the same hidden-iframe print approach already used by `PrintReportButton` / the Bible School report exports (browser "Save as PDF"), with tenant logo resolved via the existing `logo-data-url` helper and HTML escaped through the existing `escHtml` pattern.
- CSV keeps the existing quoting/escaping convention used in `CheckInPanel` and `WoFBIAttendanceTab`.
- All queries used to fetch eligible members and records reuse the existing tenant-scoped hooks (`useTenantQuery`) with explicit `tenant_id` filters — no new tables, policies, or backend changes.
- Roster buttons are gated behind the same `canManage` / admin checks that already guard the existing export buttons.
