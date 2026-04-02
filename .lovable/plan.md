

## Make My Feed Interactive

### Changes

#### 1. Expandable event details
Event cards currently show only title, location, and time. Add the same expand/collapse pattern as announcements — tapping reveals full description, end time, event mode (In Person/Online/Hybrid), and audience.

#### 2. Pull-to-refresh
Add a "Refresh" button at the top of the feed card that invalidates both the announcements and events queries, triggering a re-fetch with a brief loading state.

#### 3. Like/react to announcements
- **Database migration**: Create an `announcement_reactions` table with `id`, `announcement_id`, `user_id`, `tenant_id`, `reaction` (default `'like'`), `created_at`, with a unique constraint on `(announcement_id, user_id)` and RLS policies scoped to tenant.
- **UI**: Add a heart icon button on each announcement. Tapping toggles the like (insert/delete). Show the reaction count next to the heart.

#### 4. Share events
Add a share button on each event card. Uses the Web Share API (`navigator.share`) if available, falling back to copying event details to the clipboard.

#### 5. Read counter reduction
Track which announcements the user has expanded (read). Subtract read count from the tab badge so the counter only shows unread announcements.
- Store read announcement IDs in component state (session-level, resets on refresh).
- Badge shows `relevantAnnouncements.length - readCount` (minimum 0).

### Files changed
- **Database migration** — new `announcement_reactions` table with RLS
- `src/components/profile/MemberFeed.jsx` — all UI changes: expandable events, refresh button, like button with mutation, share button, read tracking for badge counter

### Technical details

**announcement_reactions table:**
```sql
CREATE TABLE public.announcement_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid,
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);
ALTER TABLE public.announcement_reactions ENABLE ROW LEVEL SECURITY;

-- Users can like/unlike within their tenant
CREATE POLICY "Users can manage own reactions"
ON public.announcement_reactions FOR ALL TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id))
WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

-- All tenant members can see reaction counts
CREATE POLICY "Tenant members can view reactions"
ON public.announcement_reactions FOR SELECT TO authenticated
USING (user_has_tenant_access(tenant_id));
```

**Read tracking**: Uses a `Set` in React state. When an announcement is expanded, its ID is added. The badge count = `total - readSet.size`.

**Share**: Uses `navigator.share({ title, text, url })` with a `navigator.clipboard.writeText` fallback.

