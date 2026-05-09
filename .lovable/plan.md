## Root cause

`SelfCheckInWidget` is rendered on the member dashboard, but it does this very early:

```jsx
if (!myMember) return null;
```

That `myMember` query looks for a row in `members` where `user_id = auth.uid()` and `tenant_id = currentTenant`. **22 of 105 members in WCI Cardiff have `user_id = NULL`** (and 7 auth users have no member row at all). For every one of those people the widget is silently hidden — no card, no button, no message. To them it just looks like the feature doesn't exist.

A few are also affected by:

- **Today's sessions exist** (e.g. *LEADERSHIP EMPOWERMENT SUMMIT MAY 2026* with `unit = NULL`) so eligibility is fine; the issue isn't sessions.
- The widget renders the entire card only when at least one eligible session is found — even when `myMember` is loaded, if all today's sessions are scoped to a unit the member doesn't belong to, they see nothing.

So there are really two bugs to fix:

1. **Silent null-member hide** → users with broken/missing member linkage see nothing.
2. **Empty-state invisibility** → when there are no eligible sessions, the widget should still tell the user what's going on.

## Fix

Edit only `src/components/attendance/SelfCheckInWidget.jsx` (frontend-only, no DB changes).

### 1. Always render the card

Remove `if (!myMember) return null;`. Always render the "Today's Attendance" card so members know the feature exists. Inside the card, branch on state:

- **No member profile linked** → small notice: *"Your account isn't linked to a member profile yet. Please ask an admin to link your profile so you can check in."*
- **Member loaded, no sessions today** → keep current text: *"No meetings open for check-in today."*
- **Sessions today but none eligible** → *"No meetings open to your unit/Home Cell today."*
- **Sessions eligible** → existing list with Check In buttons.

### 2. Defensive eligibility

Treat `s.unit` as null when it is an empty string (`s.unit?.trim()`), so an admin who once saved an empty unit doesn't accidentally hide the session from everyone.

### 3. Tiny diagnostic aid

When `!myMember` and `user?.id` is set, log a single console warning so an admin tailing logs can spot un-linked accounts. No PII beyond user id.

## Out of scope

- Backfilling the 22 unlinked member rows (data fix, not in scope of this UI bug).
- Changing PWA `start_url` or LandingPage redirect (the user clarified this is about the button itself, not the route).
- Database / RLS changes — RLS already permits the relevant inserts after the previous migration.

## Files

- `src/components/attendance/SelfCheckInWidget.jsx` (only file touched)
