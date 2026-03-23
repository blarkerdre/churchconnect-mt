

## Mobile Responsiveness Improvements

This plan addresses alignment and overflow issues across all pages, forms, and dialogs on mobile (384px viewport).

### 1. Dialog Component — Scrollable on Mobile
**File: `src/components/ui/dialog.jsx`**
- Add `max-h-[90vh] overflow-y-auto` to `DialogContent` so long forms (MemberForm, CertificateTemplate, etc.) scroll instead of overflowing the viewport

### 2. Dashboard — Responsive Stat Values
**File: `src/pages/Dashboard.jsx`**
- Change stat value from `text-3xl` to `text-2xl sm:text-3xl` to prevent grid overflow on small screens

### 3. Followups — Responsive Stat Values
**File: `src/pages/Followups.jsx`**
- Change stat values from `text-2xl` to `text-xl sm:text-2xl`

### 4. Members — Responsive Stat Values
**File: `src/pages/Members.jsx`**
- Change stat values from `text-2xl` to `text-xl sm:text-2xl`

### 5. MyProfile — Mobile-Friendly Edit Layout
**File: `src/pages/MyProfile.jsx`**
- On the profile header card, stack the avatar and content vertically on mobile: change `flex items-start gap-4` to `flex flex-col sm:flex-row items-start gap-4`
- Make Edit button full-width on mobile with `w-full sm:w-auto`
- Make the avatar smaller on mobile: `h-12 w-12 sm:h-16 sm:w-16`

### 6. Settings Tabs — Scrollable on Mobile
**File: `src/pages/Settings.jsx`**
- Wrap TabsList in a horizontally scrollable container: `overflow-x-auto` with `flex-nowrap` instead of `flex-wrap` so tabs don't stack awkwardly

### 7. Communications Tabs — Scrollable on Mobile
**File: `src/pages/Communications.jsx`**
- Same pattern as Settings: make TabsList horizontally scrollable with `overflow-x-auto`

### 8. AppLayout Header — Tighter Mobile Padding
**File: `src/components/AppLayout.jsx`**
- Reduce main content padding on mobile from `p-4` to `p-3 lg:p-8`
- Reduce header padding from `px-4` to `px-3`

### 9. Events — Full-Width New Event Button on Mobile
**File: `src/pages/Events.jsx`**
- Add `w-full sm:w-auto` to the "New Event" button

### 10. Followups — Full-Width New Follow-up Button
**File: `src/pages/Followups.jsx`**
- Add `w-full sm:w-auto` to the "New Follow-up" button

### Summary
All changes are CSS-only (Tailwind classes). No logic or database changes. The key fix is making the Dialog component scrollable, which instantly improves every form in the app on mobile.

