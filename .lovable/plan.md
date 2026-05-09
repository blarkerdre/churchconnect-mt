## Home Cell admin summary stats

Add a row of 4 summary stat cards above the existing reports table in the Home Cell Attendance tab, visible to admins only. Stats reflect the currently applied filters (centre + date range).

### Stats

1. **Total Cell Centres** — count of centres in scope (all centres if filter = "All", else 1).
2. **Meetings Held** — count of `filteredReports`.
3. **Meetings Not Held** — `expected − held`, floored at 0.
4. **Average Attendance** — mean of `(male + female + children)` across `filteredReports`, rounded.

### "Meetings Not Held" calculation (weekly cadence)

```text
weeks   = max(1, ceil((dateTo - dateFrom + 1) / 7))   when both dates set
        = number of distinct ISO weeks present in filteredReports' dates, else 1
centres = 1 if filterCentreId !== "all" else availableCentres.length
expected = weeks × centres
notHeld  = max(0, expected − held)
```

When no date range is set, fall back to the span between the earliest and latest report dates in scope (or hide the "Not Held" card with an em-dash + tooltip "Set a date range").

### Where

`src/components/wsf/WSFAttendanceTab.jsx` — insert a `grid grid-cols-2 sm:grid-cols-4 gap-3` of stat cards between the filter bar (line 212) and the table/empty state (line 214). Gate with `isAdmin`.

### Visuals

- Reuse the small stat-card pattern from `WSFLeaderDashboard` (icon chip + title + big number + sub-label).
- Icons: `Home` (centres), `CheckCircle2` (held), `AlertCircle` (not held), `TrendingUp` (avg).
- Use semantic tokens: `text-primary`, `text-accent`, `text-destructive`, `text-chart-3`.

### Out of scope

- No DB/schema changes. No per-centre cadence field.
- WSF leader view unchanged (still sees their own centres' reports without the admin summary).
- Print/CSV export contents unchanged.
