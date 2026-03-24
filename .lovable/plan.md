

## Multi-Feature Enhancement Plan

### Summary
Five enhancements: (1) Add Daily recurrence + hour-based reminders to events, (2) Add WSF/WSF Leader to audience options, (3) Profile picture upload with profile note display, (4) Books of the Month section on the member dashboard.

---

### 1. Daily Recurrence + Hour-Based Reminders

**Current state**: Recurrence supports Weekly, Biweekly, Monthly. Reminders support 1/3/7 days before only.

**Changes**:

- **`src/pages/Events.jsx`**: Add "Daily" to frequency options array. Add hour-based reminder options (1 hour, 2 hours, 6 hours before) alongside day-based ones. Update `generateOccurrences` to handle Daily frequency using `addDays`. Store hour reminders as fractional day values (e.g. `0.04` for 1hr, `0.08` for 2hrs, `0.25` for 6hrs) in the existing `reminder_days_before` integer[] column — or better, add a new `reminder_hours_before` integer[] column.
- **`src/components/events/EventFormDialog.jsx`**: Same — add Daily to `RECURRENCE_FREQUENCIES`, add hour-based reminder checkboxes.
- **Database migration**: Add `reminder_hours_before integer[]` column to events table.
- **`supabase/functions/send-event-reminders/index.ts`**: Update to also check hour-based reminders by comparing event datetime (date + start_time) against current time.

### 2. WSF & WSF Leader in Audience

**Current state**: Audiences built from church units + WSF centre names. No generic "WSF" or "WSF Leaders" option.

**Changes**:
- **`src/pages/Events.jsx`**: Add "WSF" and "WSF Leaders" to the `allAudiences` array.
- **`src/components/events/EventFormDialog.jsx`**: Add "WSF" and "WSF Leaders" to the `AUDIENCES` builder.

### 3. Profile Picture Upload + Profile Note

**Current state**: `members.photo_url` column exists but no upload UI. Profile displays initials only. Notes field exists as "Prayer Request".

**Changes**:
- **Database migration**: Create a public `profile-photos` storage bucket with RLS allowing authenticated users to upload to their own path.
- **`src/pages/MyProfile.jsx`**:
  - Replace the initials circle with a clickable avatar that shows the photo if `photo_url` exists.
  - Add a file input (hidden, triggered by clicking the avatar) that uploads to `profile-photos/{user_id}/{filename}`, gets the public URL, and saves it via `update_own_member_profile` RPC.
  - Show a camera/edit icon overlay on the avatar.
  - Display the member's notes/prayer request prominently in the read-only view as a "Profile Note" card.
- **`src/components/dashboard/MemberDashboard.jsx`**: Show profile photo in the welcome banner instead of initials when available.

### 4. Books of the Month on Dashboard

**Changes**:
- **Database migration**: Create `books_of_the_month` table with columns: `id`, `title`, `author`, `description`, `cover_image_url`, `month` (date), `created_by`, `created_at`, `is_active`.
  - RLS: Admins can manage, authenticated can view.
- **Database migration**: Create a public `book-covers` storage bucket for cover images.
- **`src/components/dashboard/MemberDashboard.jsx`**: Add a "Book of the Month" card section that queries `books_of_the_month` for the current month and displays the book cover, title, author, and description.
- **`src/pages/Settings.jsx`** (or a new admin section): Add a simple form for admins to set the book of the month — title, author, description, cover image upload.

---

### Technical Details

**New DB columns**: `events.reminder_hours_before integer[]`

**New DB tables**: `books_of_the_month` (id uuid PK, title text, author text, description text, cover_image_url text, month date, created_by uuid, created_at timestamptz, is_active bool default true)

**New storage buckets**: `profile-photos` (public), `book-covers` (public)

**Files to create/modify**:
- Migration: add `reminder_hours_before` to events, create `books_of_the_month` table, create storage buckets
- `src/pages/Events.jsx` — Daily recurrence, hour reminders, WSF audiences
- `src/components/events/EventFormDialog.jsx` — Daily recurrence, hour reminders, WSF audiences
- `supabase/functions/send-event-reminders/index.ts` — hour-based reminder logic
- `src/pages/MyProfile.jsx` — photo upload, profile note display
- `src/components/dashboard/MemberDashboard.jsx` — photo in banner, Books of the Month card
- New: `src/components/dashboard/BookOfTheMonth.jsx` — book display component
- New: `src/components/settings/BookOfTheMonthSettings.jsx` — admin upload/manage component
- `src/pages/Settings.jsx` — add Books of the Month settings section

