## Root cause

The Release button on **Children Church → Pickup** does call its mutation when clicked, but the result is invisible:

- `src/pages/ChildrenChurch.jsx` reports success/errors via `toast` from `sonner` (e.g. `toast.error(e.message)` in the `release` mutation's `onError`).
- `src/App.jsx` only mounts the shadcn Toaster (`<Toaster />` from `@/components/ui/toaster`). The **Sonner** Toaster (`src/components/ui/sonner.jsx`) is **never mounted**.
- Result: every `sonner` toast call in this page (and anywhere else in the app that uses `sonner`) is a silent no-op, so the user sees no error, no success, no spinner change — exactly the "Release button does nothing" symptom.

The underlying RPC call (`release_child`) most likely is throwing a validation error like `Incorrect PIN`, `PIN and adult required`, or `Not authorised to release children`, but the message never reaches the screen.

## Fix

1. **Mount the Sonner Toaster globally** in `src/App.jsx`:
   - Import `Toaster as SonnerToaster` from `@/components/ui/sonner`.
   - Render `<SonnerToaster />` next to the existing `<Toaster />` inside the app root so toasts from both libraries display.

2. **Verify the fix** by:
   - Reloading the page, selecting a child in the Pickup tab, leaving PIN/adult empty, and clicking Release → expect a visible error toast (e.g. "PIN and adult required").
   - Entering a wrong PIN → expect "Incorrect PIN".
   - Entering correct PIN + authorised adult → expect "Child released" and the row to disappear.

No other code changes are needed — the Release flow, the RPC, and the mutation wiring are all correct; only the missing toaster is hiding the feedback.

## Out of scope

- No changes to `release_child` RPC, RLS, or the PickupPanel UI.
- No migration of existing `sonner` calls to shadcn `useToast` (mounting Sonner is the smaller, safer fix and matches the rest of the codebase that already uses `sonner`).
