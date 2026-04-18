
## Plan: Announcement Engagement Analytics for Admins

### Scope (per user)
1. **Inline like counts** on each `AnnouncementCard` so admins see engagement at a glance on the Communications page.
2. **New "Announcements" tab** in the Analytics page with charts and metrics.

### Changes

**1. `AnnouncementCard.jsx`** — when `isAdmin`, fetch and show a small footer:
- Heart icon + total like count
- Click reveals popover/inline list of liker names (member full names + avatars)
- Tenant-scoped query: `announcement_reactions` joined with `members` on `user_id`, explicit `.eq("tenant_id", tenantId)`

**2. `src/pages/Analytics.jsx`** — add a new "Announcements" tab containing a new component `AnnouncementAnalytics`.

**3. `src/components/analytics/AnnouncementAnalytics.jsx`** (new) — admin-only, tenant-scoped:
- **KPI cards**: Total announcements, Total likes (period), Avg likes per announcement, Most-liked announcement
- **Bar chart** (Recharts): Top 10 announcements by like count
- **Line chart**: Likes per day over the selected date range
- **Audience breakdown**: Likes grouped by `target_audience` (donut/pie)
- **Table**: All announcements with title, audience, publish date, like count, sortable
- Date range filter (last 7/30/90 days, all time) — matches existing Analytics patterns

### Data
All from existing tables — **no schema changes needed**:
- `announcements` (title, target_audience, created_at, publish_date, tenant_id)
- `announcement_reactions` (announcement_id, user_id, created_at, tenant_id)
- `members` (for resolving liker names in inline popover)

### Security & multi-tenancy
- All queries explicitly `.eq("tenant_id", tenantId)` per security guard memory
- Tab gated on `isAdmin` from `useAuth`
- Query keys include `tenantId` to prevent cache bleed

### Files
- Edit: `src/components/comms/AnnouncementCard.jsx` (add admin like count + likers popover)
- Edit: `src/pages/Analytics.jsx` (add new tab)
- Create: `src/components/analytics/AnnouncementAnalytics.jsx` (KPIs, charts, table)
