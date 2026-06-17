## Goal
Move the Life Events section out of the main Pastoral Care list and make it a dedicated tab on the Pastoral Care page.

## Changes

**`src/pages/PastoralCare.jsx`** (only file edited)
- Wrap the page body in a shadcn `Tabs` component with `?tab=` URL sync via `useSearchParams`.
- Two tabs:
  - **Cases** (default) — current pastoral care list (`regularCases`), search bar, filters, "New Request" button, and `PastoralCareCard` grid.
  - **Life Events** — the existing Life Events block (cards listing `lifeEvents` with `LifeEventStageBadge` and Open buttons). Show a friendly empty state when none exist (currently the section is hidden when empty).
- Tab triggers display counts as small badges (`Cases · N`, `Life Events · N`).
- `LifeEventApprovalDialog` stays mounted at page level so it works from the Life Events tab.
- The unit-configuration helper card at the bottom (life-event coverage unit picker) moves under the Life Events tab since it only applies there.
- Page header, hero, and admin controls remain above the tabs unchanged.

## Out of scope
- No DB, RLS, edge function, or routing changes.
- No changes to `LifeEventApprovalDialog`, `PastoralCareRequestDialog`, or other pastoral care components.
- Sidebar/nav untouched (Life Events was never a top-level route).
