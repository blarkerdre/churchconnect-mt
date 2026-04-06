

## Fix: Announcements Not Loading — Missing Foreign Key

### Root Cause
The announcements query in `Communications.jsx` (line 424) uses a PostgREST embedded join:
```js
supabase.from("announcements")
  .select("*, profiles:created_by(full_name)")
```

This requires a foreign key from `announcements.created_by` to `profiles.user_id`. No such FK exists, so the API returns a `PGRST200` error ("Could not find a relationship between 'announcements' and 'created_by'"), causing the entire query to fail silently and return no data.

### Solution

Two changes:

1. **Database migration** — Add a foreign key from `announcements.created_by` to `profiles.user_id`
2. **Defensive fallback** — Update the select query to gracefully handle the join, and ensure the `content` field maps correctly

### Technical Details

#### Migration SQL
```sql
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
  ON DELETE SET NULL;
```

#### Code change — `src/pages/Communications.jsx` (no change needed)
The existing code at line 435 already has a fallback: `a.profiles?.full_name || "Admin"`. Once the FK exists, the join will work correctly.

### Files changed
- **Database migration** — add FK from `announcements.created_by` to `profiles.user_id`

