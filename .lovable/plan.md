## Change
In `src/components/followups/FollowupDetailPanel.jsx`, gate the Reopen action behind a password re-entry using the existing `PasswordConfirmDialog`.

1. Import `PasswordConfirmDialog` from `@/components/shared/PasswordConfirmDialog`.
2. Add `const [reopenOpen, setReopenOpen] = useState(false)`.
3. Change the Reopen button's `onClick` from `handleReopen` to `() => setReopenOpen(true)` (remove the `window.confirm`).
4. Update `handleReopen` to perform the status update without the confirm prompt; it becomes the dialog's `onConfirm`.
5. Render `<PasswordConfirmDialog open={reopenOpen} onOpenChange={setReopenOpen} title="Reopen follow-up" description="Reopening will move this follow-up back to In Progress and clear its completion date." confirmLabel="Reopen" onConfirm={handleReopen} />`.

The dialog verifies the current user's password via `supabase.auth.signInWithPassword` before running the update, matching the pattern used elsewhere in the app.
