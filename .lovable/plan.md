
## Goal

Replace per-session QR codes for Teens Attendance and Bible School Attendance with one persistent tenant-level QR per module. Scanning it:
- If exactly one session is open → routes straight to that session's check-in flow.
- If multiple sessions are open → shows a picker of the open sessions.
- If none are open → shows a friendly "no active session" page.

## UX

1. **Attendance page (workers/admins)**
   - "Session QR code" button now opens a single QR dialog per module (Teens, Bible School) that never changes across sessions.
   - Per-session QR button on individual sessions is removed; the "Close session" action moves inline on the session row.
2. **Scan target page** (`/t/:slug/teens/checkin` and `/wofbi/checkin`)
   - Fetches open sessions for the tenant/module.
   - 0 open → friendly card: "No active check-in right now. Please wait for a leader to open a session."
   - 1 open → auto-redirects into existing check-in flow for that session.
   - 2+ open → list picker (title, date/time, unit if applicable) → tap to enter that session's flow.

## Technical

### URLs

- Teens: `/t/:tenantSlug/teens/checkin` (no token). Existing token route stays for backward compatibility.
- Bible School: `/wofbi/checkin` (tenant resolved via signed-in user or `?tenant=slug`). Existing token route stays.

### RPCs (SECURITY DEFINER, minimal exposure)

- `public.list_open_teen_sessions(_tenant_slug text)` → `id, title, session_date, start_time, qr_token`.
- `public.list_open_wofbi_sessions(_tenant_slug text)` → `id, title, session_date, qr_token`.
- Both filter `status = 'open'` and the tenant resolved from slug. Grant EXECUTE to `anon, authenticated` (teens QR must work signed-out for guardians/self-checkin flow already supported).

### Frontend

- `src/pages/TeensAttendance.jsx` + `src/pages/ExamManagement.jsx` (Bible School attendance tab): replace per-row QR dialog trigger with a top-level "Session QR" button that opens a new `PersistentQRDialog` variant.
- New `src/components/teens/TeensPersistentQRDialog.jsx` and `src/components/exams/WoFBIPersistentQRDialog.jsx` (thin wrappers over existing QR dialog UI) pointing at the tenant-level URL.
- `src/pages/TeensCheckin.jsx`: when no `qr_token` param, call `list_open_teen_sessions`; render picker / auto-redirect / empty-state.
- `src/pages/WoFBICheckin.jsx`: same pattern with `list_open_wofbi_sessions`.
- Routing update in `src/App.jsx` to add the token-less variants.

### Out of scope

- No changes to Children's Church.
- No changes to session creation/close logic beyond surfacing "Close" inline.
- No change to underlying attendance records or RLS on records tables.
