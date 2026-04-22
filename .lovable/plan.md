

## Add Home Cell Centre member download + messaging to Milestone Report

Integrate Home Cell centre filtering, CSV export per centre, and messaging directly into the **Member Milestones Report** card so admins can quickly act on a single centre's roster — without leaving the report.

### What changes

In `src/components/analytics/MemberMilestoneReport.jsx`:

**1. New "Home Cell Centre" filter dropdown**
Add a 4th filter (next to Mode / Status / Unit) listing all active Home Cell centres plus "All centres" and "Unassigned". When set, the report filters members by `wsf_centre_id` (or no centre when "Unassigned" is selected). Centres are loaded via a new query against `wsf_centres` (id, name, is_active).

**2. Resolve centre name in CSV**
Add a "Home Cell Centre" pinned column to the CSV (right after Church Unit) using a centre-id → name lookup. Members with no centre show "Unassigned".

**3. Per-milestone Missing/Completed columns** (from the previously approved plan)
Always include 7 fixed columns — BFC, BCC, LCC, LDC, Water Baptism, HS Baptism, Home Cell — each cell `Missing` or `Completed`, placed right after the pinned identity columns.

**4. New "Download Centre Members" button**
Sits next to **Export CSV**. When a specific centre is selected, downloads a CSV of just that centre's members (respecting current Mode/Status/Unit/date filters). When "All centres" is selected, downloads a single CSV with members **grouped by centre** (centre name as a section header row, then that centre's rows; "Unassigned" group last).

**5. Message Members already works**
The existing **Message Members** button already messages whatever is in `filtered`, so when the centre filter is active it will message that centre's members. The audience label is extended to include the centre name (e.g. *"Missing BFC · Active · Centre: Cardiff Bay"*).

### Filename conventions

- Main export: `member-milestone-report-YYYY-MM-DD[-range][-centre-<slug>].csv`
- Centre members export: `home-cell-centre-members-<slug>-YYYY-MM-DD.csv` (or `home-cell-centres-all-YYYY-MM-DD.csv` for grouped export)

### Files touched

- `src/components/analytics/MemberMilestoneReport.jsx` — add centre query + filter state, centre dropdown UI, centre name in CSV, 7 milestone columns, "Download Centre Members" button, extend audience label.

### Acceptance checks

1. New "Home Cell Centre" dropdown appears in the filters row with All / each active centre / Unassigned.
2. Selecting a centre narrows the table, CSV export, and Message Members audience to just that centre's members.
3. Main CSV export includes a "Home Cell Centre" column and 7 milestone status columns (Missing/Completed) in addition to the full member record.
4. **Download Centre Members** button:
   - With a specific centre selected → downloads only that centre's filtered members.
   - With "All centres" → downloads one CSV grouped by centre with "Unassigned" last.
5. **Message Members** dialog title/audience reflects the active centre.
6. Mobile (384px viewport): the new dropdown and button wrap cleanly without clipping.

