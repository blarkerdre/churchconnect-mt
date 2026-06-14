## Walk-in parent PIN notifications (Email + SMS)

Extend the existing check-in flow in `src/pages/ChildrenChurch.jsx` so walk-in parents also receive their pickup PIN by **email** and **SMS**, in addition to the in-app notification already sent.

### Detection
A parent is treated as walk-in when either:
- The selected family's parent has **no `user_id`** (no app account), or
- `selectedFamily.parent.id === walkInMemberId` (freshly registered walk-in family).

### Changes (frontend only)
File: `src/pages/ChildrenChurch.jsx` — inside the `checkIn` mutation, immediately after the existing in-app notification block (~lines 517–542):

1. Fetch the primary parent and the "brought by" adult from `members` (`id, user_id, first_name, email, phone, tenant_id`), scoped by `tenant_id`.
2. For each walk-in adult that has contact details:
   - **Email** via `supabase.functions.invoke("send-email-alert", …)` with subject "Children's Church Pickup PIN" and a short body containing the child's name, PIN, and reminder to keep it private. Targeted with `member_ids: [adultMemberId]`.
   - **SMS** via `supabase.functions.invoke("send-sms", …)` with a short PIN reminder message, targeted to the adult member.
3. Wrap each send in try/catch — delivery failures must never block check-in. Show a soft success toast like "PIN sent to walk-in parent by email/SMS".

### Out of scope
- No new edge functions, schema changes, RLS, or templates.
- Registered (app-account) parents continue to receive in-app notification only, unchanged.
- Pickup (sign-out) flow is unchanged.

### Files touched
- `src/pages/ChildrenChurch.jsx` (single mutation extended).
