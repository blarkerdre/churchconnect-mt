

## Robust Reporting System with Training Gap Reports

### Overview
Add a new **Reports** tab/section to the Analytics page that provides actionable member-level reports, starting with a "Training Gaps" report showing members who have not completed specific milestones (BFC, BCC, LCC, LDC, Water Baptism, Holy Spirit Baptism, Home Cell). This is a filterable, downloadable table — not just charts.

### What Gets Built

**A new `src/components/analytics/TrainingGapReport.jsx` component** added as a new section within the Analytics page:

1. **Filter controls** at the top:
   - Multi-select for milestone type (BFC, BCC, LCC, LDC, Water Baptism, HS Baptism, Home Cell)
   - Membership status filter (Active, All, etc.)
   - Church unit filter

2. **Results table** showing members who have NOT completed the selected milestone(s):
   - Columns: Name, Phone, Email, Status, Church Unit, Missing Milestones
   - Sortable by name
   - Shows count of matching members

3. **CSV download** button to export the filtered list with headers: `First Name, Last Name, Email, Phone, Status, Church Unit, Missing Milestones`

4. **Summary cards** above the table showing counts per milestone (e.g. "42 members haven't completed BFC")

### Changes to Existing Files

**`src/pages/Analytics.jsx`**:
- Add a Tabs wrapper (Overview / Reports) around the existing content
- The "Overview" tab contains all current charts
- The "Reports" tab contains the new `TrainingGapReport` component
- The member query already fetches all needed fields (`bfc_completed`, `bcc_completed`, etc.) — reuse it

**`src/components/analytics/TrainingGapReport.jsx`** (new file):
- Receives `members` array as prop from Analytics
- All filtering is client-side (data already loaded)
- Milestone mapping: `{ "BFC": "bfc_completed", "BCC": "bcc_completed", "LCC": "lcc_completed", "LDC": "ldc_completed", "Water Baptism": "water_baptism", "Holy Spirit Baptism": "holy_spirit_baptism", "Home Cell": "winners_satellite" }`

### No Database Changes Required
All member milestone fields already exist in the `members` table and are already queried.

### Files Changed
- `src/pages/Analytics.jsx` — wrap in Tabs, add Reports tab
- `src/components/analytics/TrainingGapReport.jsx` — new component

