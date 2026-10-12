# Make the Follow-up Report fit the screen

## What the code shows

The report already has a phone-sized window and stacked buttons, but its preview table has a minimum width of 900px. The window uses a grid layout, and the report body and preview wrappers lack shrink constraints. That combination can allow the wide table to stretch the surrounding content rather than scroll only within the preview. The exact visible overflow still needs verification in a signed-in report view; the attempted direct report URL returned to the church home page.

## Changes

1. **Keep the window within the screen:** cap its width against the available screen width at every size and use the available screen height for vertical scrolling.
2. **Contain the wide preview:** add `min-w-0` and width constraints to the report body and preview wrappers so the table scrolls horizontally inside its own area, without stretching the filters or window.
3. **Keep content readable:** allow long names and notes to wrap safely; use two summary columns on phones, three on tablets, and six only when there is enough room.
4. **Keep controls reachable:** ensure the heading, date fields, selections, and footer buttons fit without clipping, retaining stacked buttons on phones.

Only change the report display. Leave filtering, counts, saved records, permissions, CSV downloads, and printed reports unchanged.

## Technical scope

Limit changes to `src/components/followups/FollowupReportDialog.jsx`, using existing interface components and semantic styling. Do not change the shared dialog component or other reports.

## Verification

- Navigate to Follow-ups through the signed-in church menu and open Generate Report with existing records.
- Check 384px, 768px, and 1280px widths and a short phone screen.
- Confirm the window stays inside the screen, filters and summary labels fit, and horizontal scrolling is confined to the table preview.
- Scroll to the footer and confirm Close, Download CSV, and Print Report remain reachable.
- Check the automatic build results for errors.