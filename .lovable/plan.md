

## Rename "WoFBI" to "Bible School" Across the Codebase

### Scope
Replace all user-facing references of "WoFBI", "Word of Faith Bible Institute", and related identifiers with "Bible School". This spans ~17 files across frontend pages, components, edge functions, and email templates.

### Changes

#### Frontend — UI Labels & Text
1. **`src/components/AppLayout.jsx`** — Nav item label: "WoFBI" → "Bible School"
2. **`src/pages/ExamManagement.jsx`** — Header "WoFBI Management" → "Bible School Management"; about section title "About WoFBI" → "About Bible School"; default about text; badge "WoFBI Open" → "Exams Open"; app_settings key stays `wofbi_about` (data compatibility) but display text changes; component names `WofbiAboutEditor`/`WofbiAboutDisplay` renamed
3. **`src/pages/Onboard.jsx`** — Feature option label: "WoFBI Exams" → "Bible School"
4. **`src/pages/TenantAdmin.jsx`** — Feature label: "WoFBI Exams" → "Bible School"
5. **`src/pages/PublicWoFBIRegistration.jsx`** — Title "WoFBI Course Registration" → "Bible School Course Registration"; description text updated; file stays same name for route compatibility
6. **`src/pages/PublicRegistration.jsx`** — Section heading "Word of Faith Bible Institute — WoFBI" → "Bible School"
7. **`src/components/exams/WoFBIRegistrationQRCode.jsx`** — Dialog title, label, download filename, description text all updated
8. **`src/hooks/useSubFeature.js`** — Keep keys `wofbi.create_course` and `wofbi.registration_qr` unchanged (data keys), only change display `name` if present

#### Routes
- URL paths (`/wofbi-register`) stay unchanged to avoid breaking existing QR codes and shared links. Only display text changes.

#### Edge Functions — Email Templates
9. **`supabase/functions/_shared/email-templates/wofbi-course-registration.tsx`** — Default course name "WoFBI Course" → "Bible School Course"; body text "Word of Faith Bible Institute (WoFBI)" → "Bible School"; footer text updated
10. **`supabase/functions/send-course-registration-email/index.ts`** — Default course name and email subject fallback updated
11. **`supabase/functions/public-wofbi-register/index.ts`** — Console log text only (no user-facing change needed)

#### Data Keys Preserved
- Database column `wofbi_highest_level` in members table — unchanged (would need migration + data update)
- App settings key `wofbi_about` — unchanged for backward compatibility
- Sub-feature keys `wofbi.create_course`, `wofbi.registration_qr` — unchanged
- Route paths `/wofbi-register` — unchanged

### Files changed
- `src/components/AppLayout.jsx`
- `src/pages/ExamManagement.jsx`
- `src/pages/Onboard.jsx`
- `src/pages/TenantAdmin.jsx`
- `src/pages/PublicWoFBIRegistration.jsx`
- `src/pages/PublicRegistration.jsx`
- `src/components/exams/WoFBIRegistrationQRCode.jsx`
- `supabase/functions/_shared/email-templates/wofbi-course-registration.tsx`
- `supabase/functions/send-course-registration-email/index.ts`

