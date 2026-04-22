

## Slim down all Milestone Report CSV exports

Reduce every CSV produced by the Member Milestone Report to a focused, easy-to-read column set. Stop dumping every member record column — keep only the essentials plus the 7 labeled milestone columns and the summary column.

### What changes

Single file: `src/components/analytics/MemberMilestoneReport.jsx` — modify `buildMemberCsvBlock(list)` so its output is shared by every export path (main "Export CSV", "Download Centre Members" single + grouped, "Download Unit Members" single + grouped).

#### New CSV column order (left → right)

1. First Name
2. Last Name
3. Email
4. Phone
5. Gender
6. Status (membership_status)
7. Church Unit
8. Home Cell Centre (resolved name, or "Unassigned")
9. Joined (created_at, formatted yyyy-MM-dd)
10. BFC — Completed / Missing
11. BCC — Completed / Missing
12. LCC — Completed / Missing
13. LDC — Completed / Missing
14. Water Baptism — Completed / Missing
15. HS Baptism — Completed / Missing
16. Home Cell — Completed / Missing
17. Missing *(or "Completed" when mode = completed)* — semicolon-joined labels of the milestones the row matches based on the active milestone selection

That's the entire column set. No more raw boolean milestone columns (`bfc_completed`, `water_baptism`, etc.), no more dump of every other member field (DOB, address, notes, ids, timestamps, etc.).

#### Implementation detail

Replace the current "all keys minus hidden" logic in `buildMemberCsvBlock` with a fixed `EXPORT_COLUMNS` array that drives both headers and row values. Reuse the existing `esc`, `formatVal`, `centreNameById`, `MILESTONES`, and `labelsFor` helpers.

```text
EXPORT_COLUMNS = [
  { key: "first_name",         label: "First Name" },
  { key: "last_name",          label: "Last Name" },
  { key: "email",              label: "Email" },
  { key: "phone",              label: "Phone" },
  { key: "gender",             label: "Gender" },
  { key: "membership_status",  label: "Status" },
  { key: "church_unit",        label: "Church Unit" },
  { key: "wsf_centre_id",      label: "Home Cell Centre", resolve: centre name },
  { key: "created_at",         label: "Joined" },
]
```

Then append the 7 milestone Completed/Missing columns and the summary column exactly as today.

`HIDDEN_KEYS` and the `PINNED` / `PINNED_LABELS` arrays become unused and are removed.

#### Scope

Every export path that currently calls `buildMemberCsvBlock` automatically inherits the new column set:

- `exportCsv` — main milestone export
- `exportCentreMembers` — single centre + grouped "all centres"
- `exportUnitMembers` — single unit + grouped "all units"

The grouped exports keep their `Centre: <name>` / `Unit: <name>` section headers and per-section header rows — only the columns inside each section change.

Print Report and the messaging dialogs are unaffected.

### Acceptance checks

1. Main **Export CSV** produces a CSV with exactly the 9 pinned columns + 7 milestone status columns + 1 summary column — nothing else.
2. **Download Centre Members** (single centre) and grouped "all centres" use the same column set; centre name appears in the "Home Cell Centre" column, or "Unassigned" when missing.
3. **Download Unit Members** (single unit) and grouped "all units" use the same column set.
4. Boolean fields like `bfc_completed`, `water_baptism`, `holy_spirit_baptism`, `winners_satellite` no longer appear as raw `Yes/No` columns — they're represented only as the labeled "Completed/Missing" columns.
5. No member record column outside the 9 pinned ones (no `address`, `dob`, `id`, `user_id`, `notes`, `created_at` duplicates, etc.) appears in any export.

