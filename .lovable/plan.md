

## Make Settings Page Mobile-Friendly

The Settings page and its sub-components are mostly mobile-ready but have a few issues at 384px viewport width.

### Changes

**1. `src/pages/Settings.jsx`**
- Reduce outer spacing from `space-y-6` to `space-y-4` on mobile
- Ensure TabsList has proper padding so tabs don't clip at edges

**2. `src/components/settings/DangerZoneSection.jsx`**
- Add `max-w-[95vw]` to AlertDialogContent so the dialog doesn't overflow on mobile
- Make the AlertDialogFooter stack vertically on mobile (`flex-col sm:flex-row`)
- Ensure the "Permanently Delete All Data" button text doesn't overflow (use `text-xs sm:text-sm`)

**3. `src/components/settings/WSFCentresSection.jsx`**
- WSF centre cards: ensure long address/host text truncates properly on mobile
- DialogFooter: stack buttons vertically on mobile (`flex-col-reverse sm:flex-row`)
- "Manage Members" button: make full-width on mobile

**4. `src/components/certificates/CertificateTemplateSettings.jsx`**
- Already mostly good (`max-w-[95vw]`, scroll, grid-cols-1/2)
- Preview/Save button row: stack vertically on smallest screens (`flex-col sm:flex-row`)
- Upload label: ensure it wraps properly on small screens

**5. `src/components/settings/ExternalLinksSection.jsx`**
- Action buttons row (arrows, edit, delete): reduce button sizes on mobile to prevent overflow
- Already has `max-w-[95vw]` on dialog — good

### Technical Detail
- All changes are CSS/Tailwind class adjustments — no logic changes
- Follows existing responsive patterns: `w-full sm:w-auto`, `flex-col sm:flex-row`, `max-w-[95vw] sm:max-w-md`
- Key fix areas: dialog widths, button stacking, text truncation, footer layouts

