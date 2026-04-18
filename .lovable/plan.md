
## Issue
Status dropdown in the **Sign-Post update** UI doesn't commit a selection. Replay shows the user opens the status select repeatedly, highlights "Contacted"/"Declined", but the highlight is removed and the dropdown closes without committing — value never persists.

## Root cause
Two components render a status dropdown for sign-post updates:
1. `SignPostDetailPanel.jsx` (slide-over on the right) — has a `<Select value={statusChange} onValueChange={setStatusChange}>` for "Post Update"
2. `ReferralUpdateDialog.jsx` — same pattern in a Dialog

Both use Radix `Select` with `value=""` initial state. Radix Select treats empty string as **no value** AND has a known issue: when `value=""` is passed and the user picks an item, it can fire `onValueChange` but the controlled `value` stays `""` if the parent state update is interrupted by a focus/blur cycle inside a portal.

But the more likely culprit here, given the replay shows the dropdown opening from inside a fixed-position slide-over panel (`SignPostDetailPanel`, `z-[61]`): the `SelectContent` portals to body with the default z-index, which sits **below** the panel's overlay/aside in some stacking contexts → the click hits the overlay, not the SelectItem, so the highlight clears and dropdown closes.

This matches the previous fix we made in `SignPostDialog.jsx` (added `z-[80]` and `position="popper"`). The same fix was **not** applied to `SignPostDetailPanel.jsx` or `ReferralUpdateDialog.jsx`.

## Plan

1. **`SignPostDetailPanel.jsx`** — update the status `<SelectContent>` to use `className="z-[80]" position="popper" sideOffset={4}` so it renders above the slide-over panel (`z-[61]`) and overlay (`z-[60]`).

2. **`ReferralUpdateDialog.jsx`** — apply the same `z-[80]` + `position="popper"` to its status `<SelectContent>` for consistency (Dialog overlay is `z-50`/`z-[70]`).

3. **Defensive value handling** — in both components, ensure `onValueChange` is the only state setter and the initial `value` is `""` (already correct). No change needed beyond z-index.

## Files
- Edit: `src/components/followups/SignPostDetailPanel.jsx` (one `SelectContent`)
- Edit: `src/components/followups/ReferralUpdateDialog.jsx` (one `SelectContent`)

Two-line fix per file.
