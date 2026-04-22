

## Remove duplicate "Training Gap" report and expand CSV to full member record

### What changes

**1. Remove duplicate report**
The `TrainingGapReport` component (Analytics → Reports tab) is a near-duplicate of `MemberMilestoneReport` — both let you pick milestones and list members missing them. The newer `MemberMilestoneReport` already does everything Training Gap does plus mode toggle, date range, messaging, and printing.

- In `src/pages/Analytics.jsx`:
  - Remove the `import TrainingGapReport from "@/components/analytics/TrainingGapReport";` line.
  - Remove `<TrainingGapReport members={members} />` from the Reports `TabsContent`.
- Delete `src/components/analytics/TrainingGapReport.jsx`.

**2. Include full member record in CSV download**
Currently the CSV only exports a subset of fields. Expand the milestone report's `exportCsv` to include every meaningful column on the `members` table for each filtered member.

In `src/components/analytics/MemberMilestoneReport.jsx`:

- **Expand the Supabase select** in the `useQuery` from the current narrow column list to `select("*")` so all columns are fetched (DOB, address, marital status, occupation, profession, emergency contact, pastoral notes, baptism dates, etc.).
- **Rewrite `exportCsv`** to dynamically build headers from the union of all keys present across the filtered members (skipping internal noise like `tenant_id` and very large JSON blobs if any). The order will be: a pinned set of human-friendly identity columns first (`First Name`, `Last Name`, `Email`, `Phone`, `Gender`, `Status`, `Church Unit`, `Joined`), followed by every remaining column in alphabetical order, then the trailing `Missing`/`Completed` summary column.
- Booleans render as `Yes`/`No`. Dates render as `yyyy-MM-dd`. Objects/arrays render as JSON strings. `null`/`undefined` render as empty.
- Filename, date-range suffix, and the on-screen table stay as they are today — only the CSV payload widens.

### Files touched

- `src/pages/Analytics.jsx` — remove import + JSX usage of `TrainingGapReport`.
- `src/components/analytics/TrainingGapReport.jsx` — delete.
- `src/components/analytics/MemberMilestoneReport.jsx` — widen `select`, rewrite `exportCsv` to include the full member record.

### Acceptance checks

1. Analytics → Reports tab no longer shows the "Training Gap" / "Select milestones to check" card; only Member Milestones, Status Conversion, and Feedback Summary remain (admin-only ones still admin-gated).
2. App still compiles — no leftover references to `TrainingGapReport`.
3. Click **Export CSV** on Member Milestones → downloaded file contains all member fields (DOB, address, marital status, occupation, all baptism/training dates, etc.) for every filtered row, with booleans as Yes/No.
4. CSV still respects current filters (mode, status, unit, joined date range).
5. Print Report and Message Members continue to work unchanged.

