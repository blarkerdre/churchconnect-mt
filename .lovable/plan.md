## Problem
On mobile, the fixed bottom tab bar (`MobileBottomNav`, `fixed bottom-0 z-50`) sits on top of the sidebar drawer (`fixed ... z-50`, full `h-screen`). Because the bottom nav renders later in the DOM, it paints above the sidebar and covers the bottom portion of its menu items when the sidebar is opened on mobile.

## Fix (frontend only, `src/components/AppLayout.jsx`)

1. Hide `MobileBottomNav` while the mobile sidebar drawer is open, so it never overlaps the sidebar's menu items:
   - Wrap the `<MobileBottomNav />` render so it only mounts when `!sidebarOpen` (or add a `hidden` class when open). Desktop (`lg:`) behavior is unchanged because the bottom nav is already `lg:hidden`.

2. As a safety net for tall menus, add `pb-20` (≈ bottom nav height + safe area) to the sidebar's scrollable nav container on mobile only (`lg:pb-0`), so if the bar is ever visible the last items still clear it.

No changes to business logic, routing, or the bottom nav itself.

## Verification
Reload on a 384px viewport, open the sidebar via the header trigger, confirm the bottom tab bar disappears and all sidebar items (including bottom-most Sign Out) are visible and tappable. Close the sidebar — bottom nav reappears. Desktop layout unchanged.