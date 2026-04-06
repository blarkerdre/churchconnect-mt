

## Fix: Announcements Not Loading — FK Points to Wrong Table

### Root Cause
The `announcements.created_by` foreign key currently references `auth.users(id)`. However, the query in `Communications.jsx` uses a PostgREST embedded join:
```js
supabase.from("announcements").select("*, profiles:created_by(full_name)")
```
This requires a FK from `announcements.created_by` to `profiles.user_id`. Since the FK points to `auth.users` instead, PostgREST returns an error and the entire query fails silently — resulting in no announcements displayed.

### Solution
Two changes:

1. **Database migration** — Drop the existing FK to `auth.users` and add a new one from `announcements.created_by` to `profiles(user_id)`.

2. **Defensive fallback in code** — Wrap the query in a try/catch so that if the join ever fails again, announcements still load (just without author names).

### Migration SQL
```sql
ALTER TABLE public.announcements
  DROP CONSTRAINT announcements_created_by_fkey;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_created_by_profiles_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
  ON DELETE SET NULL;
```

### Code change — `src/pages/Communications.jsx`
Add a fallback query if the join fails: catch the error from the main query and retry without the `profiles:created_by(full_name)` join, mapping `author_name` to `"Admin"` for all rows.

### Files changed
- **Database migration** — re-point FK from `auth.users` to `profiles(user_id)`
- `src/pages/Communications.jsx` — add error fallback for the announcements query

