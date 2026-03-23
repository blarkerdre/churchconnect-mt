

## Mobile Bottom Navigation Bar

### Summary
Add a fixed bottom navigation bar visible only on mobile (below `lg` breakpoint) for quick access to the most common member-facing pages. The sidebar hamburger menu remains available for the full navigation list.

### Design
- Fixed to the bottom of the screen, 5 tabs: **Dashboard**, **Events**, **Pastoral Care**, **Transportation**, **My Profile**
- Active tab highlighted with primary color
- Icon + small label per tab
- Hidden on desktop (`lg:hidden`)
- Main content gets bottom padding on mobile to avoid overlap (`pb-20 lg:pb-0`)
- The bar sits inside `AppLayout.jsx` alongside the existing sidebar

### Changes

**1. New component: `src/components/navigation/MobileBottomNav.jsx`**
- Renders a fixed bottom bar with 5 `Link` items
- Uses `useLocation()` to highlight the active tab
- Icons: `LayoutDashboard`, `CalendarDays`, `Heart`, `Car`, `UserCircle`
- Styled with `bg-card border-t` and safe-area padding for notched devices (`pb-safe`)
- Only renders on mobile via `lg:hidden`

**2. Update `src/components/AppLayout.jsx`**
- Import and render `MobileBottomNav` after `</main>`
- Add `pb-20 lg:pb-0` to the `<main>` element so content doesn't get hidden behind the bar

