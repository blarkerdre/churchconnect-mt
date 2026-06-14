## Goal
Allow anyone who can manage a meeting (admins, unit leaders, Home Cell leaders — for sessions they're scoped to) to delete an entire attendance session, with password re-confirmation before it goes through.

## Changes

### `src/pages/Attendance.jsx`
- Import `Trash2` from `lucide-react` and `PasswordConfirmDialog` from `@/components/shared/PasswordConfirmDialog`.
- Add state `const [deleteOpen, setDeleteOpen] = useState(false);`.
- Add a `deleteSessionMutation` that, for the selected session id, deletes child rows first (tenant-scoped):
  1. `attendance_records` where `session_id = selectedSession.id`
  2. `attendance_sessions` where `id = selectedSession.id`
  Each call adds `.eq("tenant_id", tenantId)` per project rules.
  On success: invalidate `attendance-sessions` + `attendance-records`, clear `selectedSessionId`, toast "Meeting deleted".
- In the action button row (near the existing Close Meeting button, lines 263-276), add a new **Delete Meeting** button:
  - Visible when `canManage && selectedSession` (works for both open and closed sessions, since the request is about deleting the whole session).
  - Styled destructive (icon `Trash2`, same outline pattern as Close).
  - `onClick` opens `PasswordConfirmDialog` (sets `deleteOpen=true`) — no native `confirm`.
- Render `<PasswordConfirmDialog>` at the bottom of the page with:
  - `title="Delete meeting"`
  - `description` naming the session title/date and warning that all check-ins and the meeting report will be permanently removed.
  - `confirmLabel="Delete meeting"`
  - `onConfirm={() => deleteSessionMutation.mutateAsync()}`
  - `isPending={deleteSessionMutation.isPending}`

### Scoping note
No DB changes. Leaders can already only see their own units'/centres' sessions (existing filter at lines 55-68), so the new button is automatically scoped. The mutation still passes `.eq("tenant_id", tenantId)` for defence in depth, matching the project's multi-tenancy rule.

### Out of scope
- No change to `CheckInPanel` individual-record removal behaviour.
- No change to who can see sessions.
- No audit log entry added (can be a follow-up if you want one).
