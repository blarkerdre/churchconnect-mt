## Goal
In the Children Church hub, rename the display labels only:
- Primary tab "Children" → "Early Years"
- Sub-tab "All children" → "All Early Years"

## Changes (src/pages/ChildrenChurch.jsx)
- Line 1346: primary tab label "Children" → "Early Years"
- Line 1357: sub-tab label "All children" → "All Early Years"
- Line 1411: card title "All children in this tenant (n)" → "All Early Years in this tenant (n)"
- Line 340: the "Children" section label → "Early Years"
- Sweep the rest of the page for user-visible copy that names this group (empty states, dialog titles, toasts referring to "children" as the tab/group) and align wording, leaving generic/legal wording untouched.

## Not changing
- URL params (`?tab=children`, `?sub=all`), route paths, database tables/columns, RLS, hooks, and permission logic all keep the `children` identifier — no data or access behaviour changes.
- The "Children Church" module/sidebar name stays as-is (only the inner tab is renamed).
