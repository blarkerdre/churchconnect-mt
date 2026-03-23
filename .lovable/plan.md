

## Add Admin Management of WoFBI Course Registrations

### Problem
Admins currently cannot see which members have registered for WoFBI courses, nor can they download, edit, or delete registrations.

### Approach
Add a "Registrations" view alongside the existing "Subjects & Questions" and "Course Results" views for each selected course. This tab will show all registered members with options to download as CSV, and delete (unregister) individual registrations.

### Changes

**File: `src/pages/ExamManagement.jsx`**
- Add a third toggle button "Registrations" next to "Subjects & Questions" and "Course Results" (around line 315-322)
- Add state for `showRegistrations`
- Create a new inline `CourseRegistrationsView` component that:
  - Fetches `course_registrations` joined with `members(first_name, last_name, email, phone)` for the selected course
  - Displays a table with member name, email, phone, registration date
  - Provides a "Download CSV" button for the registrations list
  - Provides a delete button per row to unregister a member (with confirmation)
  - Shows registration count stats

### No database changes needed
The `course_registrations` table already exists with appropriate RLS policies for admin management.

