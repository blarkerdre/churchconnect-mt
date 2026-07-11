## Remove "New Task" from Church Unit

Remove the **New Task** button from the Unit Tasks page header (`src/pages/UnitTasks.jsx`, lines 153–155). Everything else stays — Report, New Service Roster, tabs, and the underlying `UnitTaskFormDialog` remain in the codebase so existing tasks can still be viewed/edited.

### Scope
- Only the top-right "New Task" trigger is removed.
- No DB, API, or dialog changes.

Confirm and I'll apply.