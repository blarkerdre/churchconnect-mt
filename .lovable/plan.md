

## Add Birthday Celebration Feature

### What it does
- Show a birthday banner/card on the member dashboard when it's the member's birthday (matching day and month from `date_of_birth`)
- Show upcoming birthdays list on the admin/leader dashboard so leaders can celebrate members
- Add a "Birthdays This Week/Month" section visible to admins/leaders

### Changes

**1. `src/components/dashboard/MemberDashboard.jsx`**
- Add a birthday check: compare today's day+month against `myMember.date_of_birth`
- If it's the member's birthday, show a celebratory banner with confetti/cake icon, e.g. "Happy Birthday, [Name]!" between the welcome card and self check-in widget

**2. `src/components/dashboard/BirthdayCelebration.jsx`** (new file)
- Reusable component that accepts a member and shows a birthday card with cake icon and festive styling
- Used on both member dashboard (own birthday) and admin dashboard (list of birthdays)

**3. `src/pages/Dashboard.jsx`**
- Add a query for upcoming birthdays (members whose day+month falls within the next 7 days)
- Query uses raw day/month extraction: `EXTRACT(MONTH FROM date_of_birth)` and `EXTRACT(DAY FROM date_of_birth)`
- Since Supabase JS client doesn't support EXTRACT easily, use an RPC function
- Show an "Upcoming Birthdays" card on the admin dashboard with member names and dates (dd MMM format, no year)

**4. Database: new RPC function `get_upcoming_birthdays`**
- Takes `_tenant_id uuid` and `_days_ahead int` (default 7)
- Returns members whose birthday (month+day) falls within the next N days
- Handles year wrap-around (e.g. late December looking into January)
- Returns: `id, first_name, last_name, date_of_birth, phone, email, photo_url, church_unit`
- Security definer scoped to tenant

**5. `src/components/dashboard/MemberDashboard.jsx`** (birthday for self)
- If `myMember.date_of_birth` matches today's day+month, render the `BirthdayCelebration` banner

### Files changed
- 1 new migration — `get_upcoming_birthdays` RPC function
- `src/components/dashboard/BirthdayCelebration.jsx` — new component
- `src/components/dashboard/MemberDashboard.jsx` — add own-birthday banner
- `src/pages/Dashboard.jsx` — add upcoming birthdays card for admins/leaders

