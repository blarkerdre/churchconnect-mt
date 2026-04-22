

## Add date range filter to Member Milestone Report

### What changes

Add a "Joined between" date range filter to the **Member Milestones Report** (Analytics → Reports). Filters members by their `members.created_at` (join date) so admins can scope reports to e.g. "members who joined in the last 90 days who still haven't completed BFC".

### UI

In `MemberMilestoneReport.jsx`, add two new inputs to the existing filter grid (alongside Mode / Status / Unit), using the shadcn Popover + Calendar pattern:

```text
[ Mode ▾ ] [ Status ▾ ] [ Unit ▾ ]
[ Joined from: 📅 dd MMM yyyy ] [ Joined to: 📅 dd MMM yyyy ] [ Clear dates ]
```

- "From" and "To" each open a calendar popover (single-date picker, `pointer-events-auto`).
- Quick presets above the grid: **All time · Last 30 days · Last 90 days · This year · Custom**. Selecting a preset fills the from/to dates; choosing Custom leaves them user-editable.
- Defaults to "All time" so existing behaviour is unchanged on first load.

### Filtering logic

Extend the `filtered` useMemo to also check `m.created_at`:
- if `fromDate` is set → keep only members where `created_at >= fromDate` (start of day)
- if `toDate` is set → keep only members where `created_at <= toDate` (end of day)

### CSV / Print / Audience label

- The existing CSV already includes a `Joined` column — no schema change needed.
- Print title and the `audienceLabel` passed to `MessageFilteredMembersDialog` get a suffix like `· Joined 2026-01-01 → 2026-04-22` when a range is active, so the dialog and audit log capture the date scope.
- CSV filename includes the range, e.g. `member-milestone-report-2026-01-01_to_2026-04-22.csv`.

### Files to edit

- `src/components/analytics/MemberMilestoneReport.jsx` — add date state, preset chips, two date popovers, extend `filtered`, update `audienceLabel`, print title, and CSV filename.

No backend, RLS, or schema changes required — `created_at` is already selected by the existing query.

### Verification

1. Open Analytics → Reports → Member Milestones as admin → date controls appear under existing filters; defaults to All time and current results unchanged.
2. Select "Last 90 days" → list shrinks to members joined in the last 90 days who match milestone filters; counter updates.
3. Pick a custom From/To range across a quarter → only members with `created_at` inside the range appear; CSV downloads with the date range in the filename and `Joined` column.
4. Click **Message Filtered Members** → confirmation summary and audit log entry include the date range in the audience label.
5. Clear dates → returns to All time.
6. On the 384px mobile viewport, the date popovers open above/below the trigger and remain interactive (no overflow clipping).

