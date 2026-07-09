## Goal
Move the "Home Cells Created" report out of the main Home Cell page flow into a dedicated tab, visible only to admins.

## Changes

**`src/pages/WSFManagement.jsx`**
- Wrap the page content in shadcn `Tabs` (from `@/components/ui/tabs`).
- Tab 1 — **Attendance** (visible to all current roles: admin, WSF leader, reports officer): renders the existing `WSFAttendanceTab` and the "My Centre Members" cards block.
- Tab 2 — **Home Cells Created** (admin only, i.e. `isAdmin === true`): renders `WSFCreationReport` with the existing `centres` / `zones` / `centreMembers` props.
- Conditionally render the second `TabsTrigger` and `TabsContent` only when `isAdmin`, so WSF leaders and reports officers don't see the tab at all.
- Keep the page heading, but adjust the subtitle to reflect the tab context, or move the current "Home Cell Attendance" heading inside the Attendance tab so each tab owns its own title.

## Out of scope
- No changes to `WSFCreationReport.jsx` itself.
- No changes to data fetching / queries — they remain at the page level and feed whichever tab is active.
- No permission/RLS changes; access restriction is purely UI-level (admins already have full data access).
