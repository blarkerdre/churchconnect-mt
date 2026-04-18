
## Goal
Collapse the two separate buttons ("Refer to Unit Leader" and "Refer to Home Cell Leader") in `FollowupDetailPanel.jsx` into a single **"Refer to Leader"** button. The existing `SignPostDialog` already has tabs for both Unit Leader and Home Cell — let it handle the choice.

## Changes

### `src/components/followups/FollowupDetailPanel.jsx`
- Replace the two trigger buttons with one labelled **"Refer to Leader"** (icon: `UserCheck` or `HeartHandshake`).
- Remove the `signPostType` state (no longer needed to pre-select a tab).
- Open `SignPostDialog` without a `defaultType` prop, so it opens on its built-in default tab (Unit Leader). User can switch tabs inside the dialog.

### `src/components/followups/SignPostDialog.jsx`
- Make `defaultType` optional with fallback `"unit_leader"` (already the case — just confirm).
- No other changes; the tab UI inside already lets the user pick Unit Leader or Home Cell.

## Files Changed
- `src/components/followups/FollowupDetailPanel.jsx` — merge two buttons into one (~10 lines removed, 5 added).
- `src/components/followups/SignPostDialog.jsx` — no functional change, just verify default fallback.

No DB changes. After this lands, the panel shows a single **Refer to Leader** button; clicking it opens the dialog where the user picks the referral type via tabs.
