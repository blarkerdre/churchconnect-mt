# OC1 3-Page Pack — Add Live App Screenshots

Add real screenshots of the running app to the 3-page OC1 evidence pack so the traction
figures are backed by visible product evidence, not just numbers in a table.

## New file

`Global-Talent-OC1-Innovation-3page-v2.docx` (the current 3-page and 8-page files stay untouched).

## What changes

**Page 3 (Traction and ownership)** gains an app-evidence strip above the ownership block:

- Analytics traffic view (super admin) showing the headline cards — visitors, page views,
  views per visit, visit duration, bounce rate — plus the daily visitors trend chart. This is
  the in-product proof of the 90-day figures already quoted in the traction table.
- A second capture showing scale in the product: the church/tenant list with member counts
  (or the members directory with its total), evidencing multi-church usage at real volume.

Both are placed side by side at half content width, each with an italic caption naming the
screen and the capture date (Figures 6 and 7).

To keep the document at exactly three pages, the traction table on page 3 tightens to a
single compact row-per-metric block and the ownership figure scales down slightly.

## Capture details

- Captured with Playwright against the running app at 1440x1100, signed in as the super admin.
- Screens: Tenant Admin → Analytics (Traffic & Locations, 3-month range) and the churches
  overview with member counts.
- Cropped to the content area, no browser chrome, no personal member names visible in the
  frame — if a capture exposes individual member data, that region is cropped out or a
  summary view is used instead.

## Technical notes

- Same `docx` script pipeline, US Letter, 0.6in margins, Arial, existing heading styles.
- Captions italic 9pt, colour `5A6270`, centred, continuing the existing figure numbering.
- Images scaled to fit at aspect ratio preserved; output to `/mnt/documents/`, rendered to PDF,
  and all three pages inspected as images before delivery.
