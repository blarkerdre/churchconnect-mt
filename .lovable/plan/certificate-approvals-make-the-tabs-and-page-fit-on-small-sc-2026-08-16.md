# Certificate Approvals: make the tabs and page fit on small screens

## Why the tabs don't fit

The page has six tabs (Pending, Approved, Declined, Issued, All, Report) rendered in a single non-scrolling `TabsList`. The shadcn `TabsList` is an inline flex row with no wrapping or horizontal scrolling, so on a 384px phone the last tabs are pushed past the screen edge and the row stretches the page. The tab labels also carry counts ("Pending (12)"), which makes each trigger wider.

Two other blocks on the same page have the same problem:
- The report filter row (From / To / Status / Training type + CSV / Print) uses fixed pixel widths (`w-36`, `w-32`) that don't fit side by side on a phone.
- The "Breakdown by training type" table is not inside a horizontal scroll wrapper, so it stretches its card instead of scrolling.

## What will change

1. **Tab strip** — wrap the `TabsList` in a horizontally scrollable container with an edge fade hint; use tighter mobile padding and smaller text so more tabs are visible at 384px. Keep all six tabs and their counts.
2. **Report filters** — From/To share one row at half width each, Status and Training type each take full width on phones, and CSV/Print sit on their own row. Existing inline layout preserved from `sm:` upwards.
3. **Summary stat cards** — keep 2 columns on phones with slightly tighter padding so the "Avg days to decision" label doesn't clip.
4. **Breakdown table** — wrap in `overflow-x-auto` with a sensible `min-w` so it scrolls inside the card.
5. **Decline dialog** — responsive width (`w-[calc(100vw-2rem)] sm:max-w-lg`) with stacked full-width footer buttons on mobile.
6. **Verify** at 384px that page width equals viewport width with no clipped controls.

## Technical notes

Single file: `src/pages/CertificateApprovals.jsx` — Tailwind class and wrapper-markup changes only. No query, mutation, permission, or export-format changes.
