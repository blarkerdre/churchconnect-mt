# Make Settings fit every screen

## Goal
Make the complete Settings area clear and usable on phones, tablets, laptops, and wide screens without changing permissions, saved data, or existing settings behaviour.

## Changes
- Replace the crowded single-row settings menu on small screens with a clearly labelled, touch-friendly selector; retain the efficient tab row on larger screens.
- Keep the active section obvious and make every available section reachable without relying on unexplained icons or hidden horizontal scrolling.
- Give the page a stable responsive content width, tighter phone spacing, and comfortable desktop spacing.
- Update cards, headings, descriptions, badges, action rows, upload controls, and save buttons so they wrap or stack cleanly on narrow screens.
- Change fixed two-column form rows to one column on phones and two columns only when enough width is available.
- Make long names, URLs, provider values, usage figures, and table-like content wrap or scroll within their own area instead of widening the whole page.
- Ensure Settings dialogs fit within the visible screen, scroll internally when necessary, and keep their controls reachable.
- Apply the same treatment to all Settings sections, including branding, communications, units, Home Cell, certificates, consent, links, API, and danger controls.

## Validation
- Test the live Settings page at 384px phone, 768px tablet, and 1280px desktop widths using an administrator account.
- Open every available section and representative dialogs, checking for clipped text, horizontal page overflow, overlapping controls, and unreachable actions.
- Confirm tab/section switching, uploads, forms, save actions, and permission-based visibility still behave as before.

## Technical notes
- Reuse the existing design tokens and shared controls.
- Keep changes limited to responsive presentation; no database, permission, or business-logic changes.
