## Goals

1. Require password re-entry before any delete action across the app (no type-to-confirm).
2. Home Cell leaders should not be able to delete their own centre's attendance reports .

## 1. New shared dialog: `PasswordConfirmDialog`

Create `src/components/shared/PasswordConfirmDialog.jsx`, a lighter sibling of the existing `DangerConfirmDialog`:

- Props: `open`, `onOpenChange`, `title`, `description`, `confirmLabel` (default "Delete"), `isPending`, `onConfirm`.
- Body shows the warning and a single password input.
- Verifies via `supabase.auth.signInWithPassword({ email: user.email, password })`.
- On success, calls `onConfirm()`. On failure, shows toast and stays open.
- Same red destructive styling as `DangerConfirmDialog`, no type-to-confirm.

## 2. Replace every `window.confirm`/`confirm` delete with `PasswordConfirmDialog`

Files to update (one delete confirm each unless noted):

- `src/components/wsf/WSFAttendanceTab.jsx` — also drop the `isAdmin &&` gate so Home Cell leaders see the delete button (RLS already restricts to their own centres).
- `src/pages/Events.jsx`
- `src/pages/Transportation.jsx` (booking delete + location delete)
- `src/pages/Communications.jsx`
- `src/pages/Settings.jsx` (3 spots: list item delete, unit delete, logo/branding removals)
- `src/components/wsf/WSFCentreMembersDialog.jsx` (remove member from centre)
- `src/components/settings/WSFZonesSection.jsx`
- `src/components/settings/WSFCentresSection.jsx`
- `src/components/settings/FollowupTemplatesSection.jsx`
- `src/components/settings/ExternalLinksSection.jsx`
- `src/components/certificates/CertificateTemplateSettings.jsx`
- `src/components/tenants/InvoicesReceiptsList.jsx`

Pattern in each file: add local `useState` for `{ open, target }`, replace the `if (window.confirm(...)) deleteMutation.mutate(x)` with `setConfirm({ open: true, target: x })`, render `<PasswordConfirmDialog ... onConfirm={() => deleteMutation.mutate(confirm.target)} isPending={deleteMutation.isPending} />`.

## 3. Leave existing `DangerConfirmDialog` usages alone

Places already using `DangerConfirmDialog` (exam course/subject/session, member delete, sermon folder, tenant danger zone, etc.) keep their stronger type-to-confirm + password flow — they're truly destructive bulk operations.

## Technical notes

- No DB / RLS changes required. The Home Cell leader fix is purely a UI gating change in `WSFAttendanceTab.jsx`.
- The new dialog reuses `useAuth` and `supabase.auth.signInWithPassword` exactly like `DangerConfirmDialog` for consistency.
- Verified the existing `wsf_attendance_reports` RLS policy `"WSF leaders can manage own centre reports"` covers delete for the centre's leader.

## Out of scope

- Hard-deletes inside edit forms (e.g. `MemberFormDialog`'s built-in delete) — already covered by `DangerConfirmDialog`.
- Bulk-deletes through Danger Zone / purge functions — already gated.