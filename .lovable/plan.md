## Goal
Make Children Church use three top-level tabs — **Children | Preteens | Teens** — with the existing Check-in, Pickup, All children and Report screens nested inside the Children tab.

```text
Children Church
 ├── Children ▸ Check-in | Pickup | All children | Report
 ├── Preteens
 └── Teens
```

## Changes (all in `src/pages/ChildrenChurch.jsx`)

**Top-level tabs**
- Replace the current flat list with `Children`, `Preteens`, `Teens`.
- `Children` shows if the user has children's-church access (same `canSeeChildren` rule as today); Preteens and Teens gating is unchanged.
- Default tab is still the first one the user is allowed to see.

**Nested children tabs**
- Inside the Children tab, a second `Tabs` row renders Check-in, Pickup, All children, Report with the exact same panels and the same per-tab permissions (`All children` and `Report` stay leader/admin only).
- Default sub-tab is the first allowed one.

**URL / deep links**
- `?tab=` drives the top-level tab (`children`, `preteens`, `teens`), `?sub=` drives the children sub-tab.
- Legacy values `?tab=checkin|pickup|all|report` are mapped to `?tab=children&sub=<value>` so existing links, QR redirects and bookmarks keep working.

**Tour**
- Keep the `data-tour` attributes (`cc-tab-checkin`, `cc-tab-pickup`, `cc-tab-all`, `cc-tab-report`) on the nested triggers so the existing Children Church tour still finds its targets; add `data-tour="cc-tab-children"` on the new parent trigger.

## Not changed
- Panel logic, queries, RLS, reports, Preteens/Teens screens, public QR routes and sidebar navigation all stay as they are.
