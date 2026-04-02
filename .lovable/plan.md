

## Enhance Events Tab & Fix Refresh Behaviour

### Changes

#### 1. Add like/react to events
- Reuse the same `announcement_reactions` table — it already has a generic structure. However, since it references `announcement_id`, we need an `event_reactions` table instead.
- **Database migration**: Create `event_reactions` table (same structure as `announcement_reactions` but with `event_id` referencing `events(id)`), with tenant-scoped RLS.
- Add a Heart button to each `EventItem` with the same toggle logic as announcements.

#### 2. Add read tracking to events
- Pass `onRead` and `readEventIds` to `EventItem`. When an event is expanded, mark it as read.
- Events tab badge shows `events.length - readEventIds.size` (unread only).

#### 3. Remove share button from events
- Remove the `handleShare` function and `Share2` button from `EventItem`.
- Remove `Share2` from the import.

#### 4. Refresh preserves read state — only shows new items
- On refresh, capture the current set of known IDs before invalidating.
- After refetch, only items with IDs not in the previous known set are treated as "unread". Previously read items stay read.
- Implementation: store `readIds` and `readEventIds` as before, but on refresh do NOT reset them. Instead, merge — add all currently-known IDs to the read sets, so only genuinely new items from the server appear unread.

### Files changed
- **Database migration** — new `event_reactions` table with RLS
- `src/components/profile/MemberFeed.jsx` — all UI changes

### Technical details

**event_reactions table:**
```sql
CREATE TABLE public.event_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),
  reaction text NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own event reactions"
ON public.event_reactions FOR ALL TO authenticated
USING (auth.uid() = user_id AND user_has_tenant_access(tenant_id))
WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant members can view event reactions"
ON public.event_reactions FOR SELECT TO authenticated
USING (user_has_tenant_access(tenant_id));
```

**Refresh logic change:**
```javascript
const handleRefresh = async () => {
  setRefreshing(true);
  // Mark all currently visible items as "read" before refresh
  relevantAnnouncements.forEach(a => readIds.add(a.id));
  events.forEach(e => readEventIds.add(e.id));
  setReadIds(new Set(readIds));
  setReadEventIds(new Set(readEventIds));
  // Refetch — new items won't be in the read sets
  await Promise.all([...invalidate queries...]);
  setTimeout(() => setRefreshing(false), 600);
};
```

