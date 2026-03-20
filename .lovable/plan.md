

## Plan: Make the app mobile-friendly across all pages, forms, and dialogs

### Overview
The app already has some responsive patterns (e.g., `sm:` breakpoints on search bars, `hidden sm:table-cell` on table columns), but several areas break or feel cramped on mobile (384px viewport). This plan addresses the key mobile pain points.

### 1. AppLayout header — fix button overflow on small screens
- The header action buttons (environment badge, role badge, notification bell, sign-out) can overflow on narrow screens
- Wrap the action buttons in a flex container with `flex-wrap` and smaller gaps
- Hide the "Sign Out" text on very small screens, keep icon-only

### 2. Members page — action buttons overflow
- The admin action buttons (QR Code, CSV, Import CSV, Register Member) sit in a horizontal row that overflows on mobile
- Wrap buttons with `flex-wrap` and collapse button labels to icon-only on mobile using `hidden sm:inline` for text
- The "Register Member" button should stay full-width on mobile as the primary CTA

### 3. UserManagement page — table too wide for mobile
- The 6-column table (User, Email, Roles, Led Units, Manage Roles, Actions) is unusable on mobile
- Hide Email, Led Units, and Manage Roles columns on small screens (`hidden md:table-cell`)
- Show email below the user name on mobile (like the Members table pattern)
- Add a mobile-specific card layout alternative or at minimum hide non-essential columns

### 4. UserManagement header — buttons overflow
- "Bulk Unit Assign" and "Add User" buttons sit in a row that overflows
- Stack these vertically on mobile, or collapse labels to icons

### 5. Attendance page — session selector and action buttons overflow
- The `flex-wrap` filter bar with session selector (w-72), badges, and action buttons can overflow
- Make session selector full-width on mobile (`w-full sm:w-72`)
- Stack action buttons below on mobile

### 6. SystemLogs — DateRangePicker and filter bar overflow
- Date range buttons are 150px each, plus template/status selects (w-48, w-36), plus CSV button
- Make date buttons full-width on mobile, stack filters vertically
- Make the `TabsList` scrollable on mobile

### 7. Dialog forms — ensure proper scroll and sizing
- `MemberFormDialog` uses `max-w-2xl max-h-[90vh] overflow-y-auto` — already good
- `WSFAttendanceFormDialog` uses `max-w-md max-h-[90vh] flex flex-col` — good
- `WSFCentreFormDialog` uses `max-w-lg max-h-[90vh] overflow-y-auto` — good
- Event dialog uses `max-w-md` — good
- Ensure all DialogContent has proper padding and doesn't clip on 384px screens

### 8. Transportation, PastoralCare, Communications — minor fixes
- Ensure action button groups use `flex-wrap` consistently
- Make search inputs full-width on mobile (already mostly done)

### 9. Dashboard stat cards — text sizing
- Stat cards with `text-2xl` values can look oversized in tight 2-col grids on small phones
- Reduce to `text-xl` on mobile for better fit

### Technical details

**Files to modify:**
- `src/pages/Members.jsx` — wrap admin buttons, icon-only on mobile
- `src/pages/UserManagement.jsx` — hide table columns on mobile, stack header buttons, show email inline
- `src/pages/Attendance.jsx` — full-width session selector on mobile, stack action buttons
- `src/pages/SystemLogs.jsx` — full-width date pickers on mobile, scrollable tabs
- `src/pages/Communications.jsx` — minor flex-wrap adjustments
- `src/pages/Events.jsx` — already mostly good, minor touch-up
- `src/pages/Followups.jsx` — already mostly good
- `src/pages/Transportation.jsx` — minor flex-wrap
- `src/components/AppLayout.jsx` — tighten header on mobile

**No backend changes needed.** All changes are CSS/layout adjustments using existing Tailwind responsive utilities.

