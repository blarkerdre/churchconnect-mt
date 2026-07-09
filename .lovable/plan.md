## Why Reopen appears to do nothing

The Reopen button *is* firing (`setReopenOpen(true)` runs and the dialog mounts) — but the dialog is invisible.

- `FollowupDetailPanel` wraps its full-screen overlay + slide-in panel in `<div className="fixed inset-0 z-[55]">`.
- The shared `PasswordConfirmDialog` uses shadcn `AlertDialog`, whose `AlertDialogOverlay` and `AlertDialogContent` are both `z-50`.
- Since 50 < 55, the password dialog opens **behind** the follow-up panel's dim overlay, so clicks appear to do nothing.

(Session replay confirms: the "Reopen follow-up" dialog *did* mount earlier — it only became visible after the panel was closed by navigation.)

## Fix

Raise the `AlertDialog` layer above the `z-[55]` slide-in panels used across the app.

Edit `src/components/ui/alert-dialog.jsx`:
- `AlertDialogOverlay`: change `z-50` → `z-[60]`
- `AlertDialogContent`: change `z-50` → `z-[60]`

This is a one-line change per element and keeps all alert dialogs consistently above detail panels (follow-ups, and any other panel using `z-[55]`). Regular toasts/tooltips remain above `z-[60]`.

## Verification

1. Open a Completed follow-up → click **Reopen (Mark In Progress)**.
2. The password dialog should now appear centred over the panel, with an interactive password field and enabled Reopen button once a password is typed.
3. Submitting with the correct password should flip the follow-up back to In Progress and clear `completed_date`.
