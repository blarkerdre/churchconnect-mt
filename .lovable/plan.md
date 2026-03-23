

## Mobile-Friendly Settings and Members Pages

### Settings Page (`src/pages/Settings.jsx`)

1. **Hide tab scrollbar** — Add `-webkit-scrollbar` hiding via `scrollbar-hide` utility or inline style on the TabsList so the horizontal scroll works without a visible scrollbar
2. **Settings list items** — Change item rows from `flex items-center justify-between` to allow text wrapping: reduce padding from `p-3` to `p-2.5 sm:p-3`, and allow item name text to truncate with `truncate min-w-0`
3. **Card header layout** — In `SettingsListSection` and `ChurchUnitsSection`, stack the title and Add button vertically on mobile: `flex flex-col sm:flex-row sm:items-center gap-2`; make Add button full-width on mobile `w-full sm:w-auto`
4. **Church units rows** — Stack unit name + badge and action buttons: wrap the unit name text with `truncate` to prevent overflow on narrow screens
5. **Notification cards** — Reduce padding from `p-4` to `p-3 sm:p-4` on the notification preference cards

### Members Page (`src/pages/Members.jsx`)

1. **Table cell padding** — Reduce from `p-4` to `p-3 sm:p-4` for all `<th>` and `<td>` elements to reclaim space on 384px screens
2. **Hide Account column on mobile** — Add `hidden sm:table-cell` to the Account column header and cells (it's admin-only detail not critical on mobile)
3. **Status badge text** — Add `text-xs` and `whitespace-nowrap` to prevent badge wrapping
4. **Action buttons row** — Make the toolbar buttons grid-based on mobile: change the button container to `grid grid-cols-4 sm:flex` so QR/CSV/Import/Register buttons lay out evenly on small screens
5. **Member avatar** — Reduce from `h-9 w-9` to `h-8 w-8 sm:h-9 sm:w-9` on mobile

### Member Form Dialog (`src/components/members/MemberFormDialog.jsx`)

1. **Dialog width** — Add responsive width: `max-w-[95vw] sm:max-w-2xl` so it doesn't clip on 384px screens

### Files to edit
- `src/pages/Settings.jsx`
- `src/pages/Members.jsx`
- `src/components/members/MemberFormDialog.jsx`

All changes are CSS/Tailwind only — no logic changes.

