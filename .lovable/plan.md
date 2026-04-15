

## Fix Truncated Progress Note in Follow-up Detail Panel

### Problem
On mobile (384px viewport), the "Add progress note" textarea and button at the bottom of the follow-up detail panel are overlapped by the mobile bottom navigation bar. Both use `z-50` and `fixed` positioning, causing the nav bar to cover the input area.

### Solution
Add bottom padding to the progress note container to account for the mobile bottom nav bar height (64px + safe area inset), ensuring the textarea and "Add Note" button are fully visible and tappable.

### Changes

**`src/components/followups/FollowupDetailPanel.jsx`** (line 457):
- Add `pb-20 lg:pb-4` to the progress note container div (replacing `p-4`) so it clears the mobile bottom nav
- Alternatively, bump the detail panel's z-index above the bottom nav (`z-[55]` on line 167) so the panel sits above the nav entirely

The cleaner fix is raising the z-index of the detail panel overlay from `z-50` to `z-[55]` (line 167), since the entire panel should sit above the bottom nav when open. This is a single-character change that fixes the overlap for all content, not just the note area.

### Files Changed
- `src/components/followups/FollowupDetailPanel.jsx` — raise z-index from `z-50` to `z-[55]` on the outer container

