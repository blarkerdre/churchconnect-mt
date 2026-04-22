

## Add per-Unit + per-Centre download & messaging in the Milestone Report

The report already lets admins filter by Unit and by Home Cell Centre, export a milestone CSV, and message the filtered set. This adds **roster-level actions** so admins can download or message *every* member of a unit (or every member of a centre) in one click — independent of milestone selection.

### What changes (single file: `src/components/analytics/MemberMilestoneReport.jsx`)

#### 1. New "Roster actions" row

A new compact row appears under the existing Mode / Status / Unit / Home Cell Centre filter grid, with two action groups:

**Unit roster**
- **Download Unit Members** — mirrors the existing centre button:
  - With a specific Unit selected → CSV of just that unit's members (respecting Status + Joined date filters).
  - With "All Units" → one CSV grouped by unit (section header + rows per unit), with an "Unassigned" group for members whose `church_unit` is empty.
- **Message Unit Members** — opens the existing `MessageFilteredMembersDialog` pre-loaded with the unit roster (or the full multi-unit roster when "All Units" is selected). Audience label reflects the unit (e.g. *"Unit roster: Ushers · Active"*).

**Home Cell Centre roster**
- **Download Centre Members** — the existing button, kept and relabelled for symmetry ("Download Centre Members" / "Download All Centres").
- **Message Centre Members** — new button, opens the messaging dialog pre-loaded with the centre roster (or all centres flattened when "All Centres" is selected). Audience label reflects the centre (e.g. *"Centre roster: Cardiff Bay · Active"*).

The existing **Export CSV** + **Message Members** + **Print Report** buttons in the bottom action row stay exactly as they are — those continue to act on the milestone-filtered list.

#### 2. Roster builder (shared logic)

Add two memoised helpers in the component:

- `buildUnitRoster(unit)` — applies the same Status + Joined-date filters as the table, splits `church_unit` on commas, returns members where `unit` matches (or members with no unit when `unit === "__unassigned"`).
- `buildCentreRoster(centreId)` — same Status + Joined-date filters, returns members with `wsf_centre_id === centreId` (or `!wsf_centre_id` for unassigned).

These are reused by both the download and messaging buttons so the roster is always consistent.

#### 3. Dialog wiring

Reuse a single `MessageFilteredMembersDialog` instance but switch the `members` prop and `audienceLabel` based on which trigger opened it. New local state:

```text
messageMode: "milestone" | "unit" | "centre"
messageRosterUnit: string | null
messageRosterCentreId: string | null
```

The existing `messageOpen` flag is reused; the dialog reads `messageMode` to pick the correct member array and label.

#### 4. CSV filename conventions

- Unit single: `member-roster-unit-<slug>-YYYY-MM-DD.csv`
- Unit grouped: `member-roster-units-all-YYYY-MM-DD.csv`
- Centre single (existing): `home-cell-centre-members-<slug>-YYYY-MM-DD.csv`
- Centre grouped (existing): `home-cell-centres-all-YYYY-MM-DD.csv`

All CSVs continue to use the existing `buildMemberCsvBlock` so they include the full member record + 7 milestone status columns + Home Cell Centre name column.

#### 5. Mobile (384px viewport)

The new buttons sit in a `flex flex-wrap gap-2` row so they stack cleanly on narrow screens, matching the existing button row pattern.

### Acceptance checks

1. With a specific **Unit** selected, **Download Unit Members** downloads a CSV of just that unit's members (respecting Status + date filters).
2. With **All Units** selected, **Download Unit Members** downloads one CSV grouped by unit with an "Unassigned" section last.
3. **Message Unit Members** opens the messaging dialog with the unit roster pre-loaded; audience label shows the unit name.
4. With a specific **Centre** selected, **Message Centre Members** opens the dialog with that centre's roster; "All Centres" loads every centre's members flattened.
5. Existing **Export CSV**, **Message Members**, **Print Report**, **Download Centre Members** continue to behave exactly as before.
6. New buttons wrap cleanly at 384px without clipping or horizontal scroll.

