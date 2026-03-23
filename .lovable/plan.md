

## Fix: QR Registrations Not Visible — Missing Foreign Key

### Problem
The `course_registrations` table has no foreign key constraint linking `member_id` to `members.id`. Without this FK, the Supabase client query `.select("..., members(first_name, last_name, email, phone, user_id)")` cannot resolve the join. It silently returns `null` for the `members` object, making QR registrations (and potentially all registrations) appear without member details.

Additionally, `course_id` has no FK to `exam_titles.id`, which should also be added for the same reason.

### Fix

**Database migration** — Add foreign key constraints:
```sql
ALTER TABLE public.course_registrations
  ADD CONSTRAINT course_registrations_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;

ALTER TABLE public.course_registrations
  ADD CONSTRAINT course_registrations_course_id_fkey
  FOREIGN KEY (course_id) REFERENCES public.exam_titles(id) ON DELETE CASCADE;
```

### No code changes needed
The query in `ExamManagement.jsx` is already correct — it just needs the FK to exist for the join to work. Once the FK is added, member details (name, email, phone, user_id) will populate for all registrations including QR/public ones.

