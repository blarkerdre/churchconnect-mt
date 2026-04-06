

## Fix: Announcements Not Visible in Communications

### Problem
The `visibleAnnouncements` filter on line 442-452 of `Communications.jsx` only matches `audience === "All Members"` for non-admin users. However, the database column `target_audience` defaults to `'All'`, and some announcements may have `null` audience. These get filtered out for regular users, showing "No communications found."

### Solution
Update the audience filter to also match `"All"` and falsy (null/empty) values, consistent with how `MemberFeed.jsx` already handles this.

### Change

#### `src/pages/Communications.jsx` (line 444)
Replace:
```js
if (a.audience === "All Members") return true;
```
With:
```js
if (!a.audience || a.audience === "All Members" || a.audience === "All") return true;
```

Also filter out unpublished announcements for non-admins (line 443, add before the audience checks):
```js
if (!isAdmin && !a.is_published) return false;
```

### Files changed
- `src/pages/Communications.jsx` — fix audience filter to include "All" and null values, hide unpublished for non-admins

