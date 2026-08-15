# Training Report: fit and display properly on all screens

The Training Report page currently overflows on narrow phones (384px): the header action buttons, the filter row, the wide records table and the record/edit dialog all push sideways or squeeze content.

## What changes

### Header
- Title block and action buttons stack cleanly on phones; the Certificates Report / Certificate Approvals / Record Session buttons become a wrapping full-width row with equal-height compact buttons instead of overflowing.

### Summary cards
- Keep 2 columns on phones but reduce padding and number size slightly so long labels ("Total Attendance", "Water Baptisms") no longer wrap awkwardly or clip.

### Filters toolbar
- On phones the From/To date inputs share one row at 50% width each, the type filter takes the full width, and CSV/Print sit on their own row. On larger screens the current inline layout is kept.

### Session Records list
- On phones, replace the horizontally scrolling table with a stacked card per session: date + type badge at the top, a compact stat strip (Total / M / F / HG / WB), recorder and recorded-on as small text, and the Attendees / Edit / Delete actions in a row.
- From `md` upwards the existing table stays, with the table wrapper keeping horizontal scroll as a fallback and cells allowed to wrap where safe.
- The expanded attendees panel spans the full row on both layouts and scrolls inside itself rather than widening the page.

### Record / Edit Session dialog
- Dialog width becomes responsive (`w-[calc(100vw-2rem)] sm:max-w-lg`) with scrollable body, so it no longer sits wider than the phone screen.
- The Training Type / Date / Title grid becomes single-column on phones; the Male/Female/Total row stays 3-up but with tighter gaps; the Spiritual Outcomes pair stacks on very narrow widths.
- Attendee search results and selected-attendee rows truncate long names/emails instead of stretching the dialog.
- Save button remains full-width and reachable at the bottom.

## Technical notes

- Single file: `src/pages/TrainingReports.jsx` (presentation only — no query, mutation or permission logic changes).
- Use existing Tailwind semantic tokens and shadcn components; no new dependencies.
- Mobile card list and desktop table render from the same `reports` array via `hidden md:block` / `md:hidden` wrappers, so CSV and print exports are unaffected.
