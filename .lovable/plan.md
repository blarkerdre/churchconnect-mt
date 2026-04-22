## 2. New "Home Cell Centre Members" section in Reports

In **Analytics → Reports** (admin-only), add a new card below `MemberMilestoneReport`:

```text
Home Cell Centre Members
[ Centre: All Centres ▾ ] [ Status: All ▾ ]   42 members across 6 centres
[ ⬇ Export Centre Members CSV ]   [ 🖨 Print ]

▸ North Cardiff (12 members)
▸ East Cardiff (8 members)
▸ Unassigned (3 members)
```

- Lists every member grouped by their assigned Home Cell centre (`members.wsf_centre_id` joined to `wsf_centres.name`), plus an "Unassigned" group for members with `winners_satellite = true` but no centre.
- Centre and Status filters narrow the view.
- **Export Centre Members CSV** downloads a single CSV with all listed members and these columns:  
`Centre, Centre Leader, First Name, Last Name, Email, Phone, Gender, Status, Church Unit, Joined`  
Rows are ordered by Centre then Last Name. Filename: `home-cell-centre-members-YYYY-MM-DD.csv`.
- Print uses the existing `PrintReportButton` pattern with a grouped layout.
- Only visible to admins (gated the same way as the other Reports tab cards).

### Files

- **Edit** `src/components/analytics/MemberMilestoneReport.jsx` — extend `exportCsv` with the 7 milestone Completed/Missing columns and exclude raw milestone bools from auto-collected keys.
- **Create** `src/components/analytics/HomeCellCentreMembersReport.jsx` — new card with centre/status filters, grouped list, CSV export, print.
- **Edit** `src/pages/Analytics.jsx` — render `<HomeCellCentreMembersReport />` inside the Reports tab, admin-gated.

### Acceptance criteria

1. Export the milestone CSV → between the identity columns and the rest of the fields you see 7 new columns (BFC, BCC, LCC, LDC, Water Baptism, HS Baptism, Home Cell), each cell `Completed` or `Missing`. Raw Yes/No duplicates of those fields no longer appear.
2. The trailing summary column (`Missing` / `Completed` per active mode) still shows the matched-milestone list.
3. All current filters (mode, status, unit, joined date range) and full member record columns are preserved; filename still carries the date range suffix.
4. New "Home Cell Centre Members" card appears in Analytics → Reports for admins; centre + status filters work; member counts per centre match the table.
5. Export Centre Members CSV downloads a file with all visible members grouped by centre, including an "Unassigned" group for Home-Cell members with no centre selected.
6. Non-admins (regular member or unit leader) do not see either the Milestone or Home Cell Centre Members reports.