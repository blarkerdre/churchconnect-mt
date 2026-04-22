

## Add "Unassigned (no unit)" filter to the Milestone Report

The Unit dropdown in the Milestone Report currently lets admins pick **All Units** or any named unit — but there's no way to isolate members who belong to **no unit at all**. The plumbing is already there (`memberInUnit(m, "__unassigned")` returns members with empty `church_unit`, and the grouped "Download Unit Members" export already emits an "Unassigned" section). This change exposes that slice as a first-class filter so admins can report on, download, and message unit-less members.

### What changes

Single file: `src/components/analytics/MemberMilestoneReport.jsx`.

1. **Unit dropdown** (around the existing `<Select value={unitFilter}>`): add a new option directly under "All Units":
   ```
   All Units
   Unassigned (no unit)   ← new
   ──────────────
   <named units…>
   ```
   Value: `__unassigned` (matches the sentinel already used by `memberInUnit`).

2. **Milestone filter logic** (`filtered` useMemo, ~line 127): when `unitFilter === "__unassigned"`, keep only members whose `church_unit` is empty/whitespace. Otherwise behave as today.

3. **Roster derivation** (`unitRoster` useMemo, ~line 319): already calls `memberInUnit(m, unitFilter)` — when `unitFilter === "__unassigned"` this Just Works. No change needed beyond making sure the early-return for `"all"` isn't accidentally hit.

4. **Roster export** (`exportUnitMembers`, ~line 332): the existing single-unit branch (`unitFilter !== "all"`) handles `__unassigned` correctly via `memberInUnit`. Tweak the filename to `member-roster-unassigned-…csv` when `unitFilter === "__unassigned"` (currently it would slugify the literal `__unassigned`).

5. **Audience labels** (`unitAudienceLabel`, milestone label suffix ~line 401, 403): when `unitFilter === "__unassigned"`, render the human label `Unassigned (no unit)` instead of the raw sentinel — both in the messaging dialog audience and in the milestone report header context.

6. **Buttons + roster-action visibility**: the existing **Download Unit Members** and **Message Unit Members** buttons remain visible and now operate on the unassigned slice when that option is chosen. No new buttons.

### Acceptance checks

1. Opening the **Unit** filter shows a new **Unassigned (no unit)** option just under "All Units".
2. Selecting it filters the on-screen milestone results to only members with no `church_unit` value.
3. **Download Unit Members** produces a CSV named `member-roster-unassigned-YYYY-MM-DD.csv` containing exactly those members, using the standard 18-column export layout.
4. **Message Unit Members** opens the messaging dialog pre-loaded with the unassigned roster; audience label reads `Unit roster: Unassigned (no unit) · …`.
5. Other unit selections, "All Units" grouped export (which still includes the existing "Unassigned" section at the bottom), centre roster actions, milestone CSV, and print report behave exactly as before.

