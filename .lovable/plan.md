

## Fix: Follow-up Assignment Notifications Not Reaching Assignee

### Root cause
The `notify-followup-assignment` edge function resolves the assignee's email and phone by querying `profiles` and `members` using `user_id`. If either:
- The assignee's `profiles` row has no `email`
- The `members` query by `user_id` returns no match (e.g., user_id not linked, or wrong tenant)

...then `recipientEmail` and `recipientPhone` are both `undefined`, and the function silently skips sending — no error is logged.

### Fix
Update `supabase/functions/notify-followup-assignment/index.ts` to:

1. **Add a fallback lookup**: If the `user_id`-based lookup yields no email/phone, also try looking up the assignee via `auth.users` email (using admin API) as a last resort
2. **Log a warning** when no contact channel is found, so the issue is visible in logs
3. **Also check `profiles.email` from the auth user's email** — the profile `email` field may be null even though auth has it

### Specific changes

**`supabase/functions/notify-followup-assignment/index.ts`**:
- After the existing profile + member lookups, add a fallback: if no email found, use `supabase.auth.admin.getUserById(assigned_to)` to get the auth user's email
- Add explicit warning log: `console.warn("No contact channel found for assignee", assigned_to)` when both email and phone are missing
- This ensures even if the `profiles` table email is empty, the auth email is used

### Technical detail
```text
Current flow:
  profiles.email → memberRecord.email → (nothing if both null)

Fixed flow:
  profiles.email → memberRecord.email → auth.users.email → warn if still null
```

### Files changed
- `supabase/functions/notify-followup-assignment/index.ts` — add auth fallback + warning log

