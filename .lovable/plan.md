

## Fix: Mobile Header Role Badge Overlap

### Problem
At 384px viewport, the sticky header in `AppLayout.jsx` lays out two columns with `flex items-center justify-between` and the right side uses `flex-wrap`. With the env label, tenant name pill, notification bell, and sign-out button all crammed in, the right cluster wraps onto two rows and visually overlaps/covers the small role label (`getRoleTitle()`) shown under the page title on the left.

### Fix

**`src/components/AppLayout.jsx` (header, lines 287–331)**

Restructure the mobile header so the role label is no longer at risk of being overlapped:

1. Remove the small role `<p>` under the page title on the left (line 303).
2. Below the main header row, add a dedicated second row (mobile-only, `sm:hidden`) that shows the role as a small pill badge, sitting cleanly under the title with no overlap risk.
3. Keep the desktop role pill (`hidden sm:inline`) on the right untouched.
4. Tighten the right cluster by adding `min-w-0` and reducing pill `max-w` so wrapping is less aggressive.

### Result
- Mobile: page title on top row (left) + action buttons (right). A clean second row shows the role badge.
- Desktop: unchanged.

### Files Changed
- `src/components/AppLayout.jsx` — restructure header role display (~10 lines)

