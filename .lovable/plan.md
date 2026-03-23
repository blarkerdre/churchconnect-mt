

## Mobile-Friendly Settings Page — Remaining Fixes

The Settings page already has scrollable tabs and some responsive patterns, but the sub-components (WSF Centres, External Links, Certificate Templates) still have layout issues at 384px.

### Changes

**1. `src/components/settings/WSFCentresSection.jsx`**
- Card header: stack title + "Add Centre" button vertically on mobile (`flex flex-col sm:flex-row sm:items-center gap-2`), button `w-full sm:w-auto`
- WSF centre cards: reduce padding from `p-4` to `p-3 sm:p-4`
- Dialog: add `max-w-[95vw] sm:max-w-md` for mobile fit

**2. `src/components/settings/ExternalLinksSection.jsx`**
- Card header: stack vertically on mobile (`flex flex-col sm:flex-row sm:items-center gap-2`), button `w-full sm:w-auto`
- Link rows: reduce action button sizes, reduce padding `p-2.5 sm:p-3`
- Dialog: add `max-w-[95vw] sm:max-w-sm`

**3. `src/components/certificates/CertificateTemplateSettings.jsx`**
- Card header: stack vertically on mobile (`flex flex-col sm:flex-row sm:items-center gap-2`), button `w-full sm:w-auto`
- Template rows: truncate training type text, reduce padding
- Form dialog: `max-w-[95vw] sm:max-w-md`
- Preview dialog: `max-w-[95vw] sm:max-w-3xl`
- Color inputs grid: stack on mobile `grid grid-cols-1 sm:grid-cols-2`

**4. `src/pages/Settings.jsx`**
- Tab triggers: hide text labels on smallest screens, show icon-only below `sm` using `hidden sm:inline` on label text — keeps tabs compact at 384px
- Reduce page title from `text-xl` to `text-lg sm:text-xl`
- Feature toggles rows: reduce padding to `p-2.5 sm:p-3`

All changes are Tailwind-only — no logic changes.

