## Goal
Sweep the app for places where user-triggered actions can fail (or succeed) silently and ensure every one surfaces a toast.

## Scope — what to fix

### A. Mutations missing `onError` toasts
These files have `useMutation` calls without paired `onError` handlers — failures vanish into the console:

1. `src/pages/MyFamily.jsx` — 1 mutation missing onError
2. `src/pages/Transportation.jsx` — 1 mutation missing onError
3. `src/pages/Communications.jsx` — 2 mutations missing onError
4. `src/components/profile/MemberFeed.jsx` — 2 mutations missing onError
5. `src/components/tenants/TenantUsersDialog.jsx` — 1 mutation missing onError
6. `src/components/settings/ApiKeysSection.jsx` — 2 mutations missing onError
7. `src/components/settings/FollowupTemplatesSection.jsx` — 2 mutations missing onError

For each, add a standard `onError: (e) => toast({ title: "...", description: e.message, variant: "destructive" })` (or sonner `toast.error`) matching the file's existing toast style.

### B. Silent / swallowed catch blocks on user actions
Audit results show several `catch` blocks that don't notify the user. Add toasts where the catch wraps a user-initiated action (not background best-effort work):

- `src/pages/ChildrenChurch.jsx` lines ~151, 255, 540, 772 — confirm each: surface errors for actions the user triggered (check-in, release, walk-in). Leave best-effort notification/audit catches silent but add a `console.warn`.
- `src/pages/UserManagement.jsx` line ~117 — verify and toast if user-initiated.
- `src/hooks/usePushSubscription.js` ~64 — keep silent (background), just add console.warn.
- `src/pages/PastoralCare.jsx` ~147 — notification side-effect; keep silent + console.warn.
- `src/pages/Transportation.jsx` 216, 248 — explicit "swallow" comments; leave but add console.warn.

### C. Verify Sonner is mounted
`<SonnerToaster />` is already in `src/App.jsx` — no change.

## Out of scope
- Refactoring existing working toasts.
- Changing toast styling/positioning.
- Background/best-effort catches that intentionally swallow (just add `console.warn` for debuggability).
- New features or business-logic changes.

## Verification
- Open each touched file; trigger the corresponding action with a forced error (e.g. network offline) and confirm a destructive toast appears.
- Confirm no regressions in success-path toasts.

## Technical notes
- Match the toast API already imported in each file (`useToast` legacy vs `sonner`). Don't introduce a new import style mid-file.
- Standard error toast shape:
  ```js
  onError: (e) => toast({
    title: "Action failed",
    description: e?.message ?? "Please try again.",
    variant: "destructive",
  })
  ```
- For sonner files: `onError: (e) => toast.error(e?.message ?? "Action failed")`.
