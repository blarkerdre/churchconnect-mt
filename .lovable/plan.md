# Notify parent with pickup code on check-in

When a Children Church worker completes drop-off, send the selected parent an in-app notification containing the 6-digit pickup PIN and the children it covers, in addition to the on-screen PIN shown to the worker.

## Behaviour

- Trigger: successful `checkin_child` RPC for all selected children (existing flow in `src/pages/ChildrenChurch.jsx`).
- Recipient: the parent chosen during drop-off (`selectedFamily.parent`). Only sent when that parent has a linked `user_id` (i.e. an app account). If they don't, the worker still sees the PIN on screen and we silently skip — no error toast.
- Channel: in-app notification (existing `notifications` table). The bell and `useMessageAlerts`-style realtime feed already handle delivery + chime; push delivery follows automatically via the existing trigger → `send-push` pipeline.
- Content:
  - title: `"Pickup code for <child names>"` (truncated for many children)
  - message: `"Your pickup PIN is <PIN>. Show this at pickup. Do not share."`
  - `type: "children_church"`, `reference_type: "children_church"`, `reference_id: <first child_checkin id or child id>`, `tenant_id`.
- Worker UX unchanged: the PIN card still displays for the worker to verbally confirm.

## Implementation

Edit `src/pages/ChildrenChurch.jsx` only — no schema or RPC changes.

In the `checkIn` mutation's `mutationFn`, after the per-child RPC loop succeeds:

1. Look up the parent's `user_id`:
   ```js
   const { data: parent } = await supabase
     .from("members")
     .select("user_id")
     .eq("id", selectedFamily.parent.id)
     .eq("tenant_id", tenantId)
     .maybeSingle();
   ```
2. If `parent?.user_id`, insert one notification (tenant-scoped):
   ```js
   await supabase.from("notifications").insert({
     user_id: parent.user_id,
     tenant_id: tenantId,
     title: `Pickup code for ${snapshot.map(c => c.first_name).join(", ").slice(0, 80)}`,
     message: `Your pickup PIN is ${pin}. Show this at pickup. Do not share.`,
     type: "children_church",
     reference_type: "children_church",
   });
   ```
   Wrap in try/catch and log on failure — never block the check-in success path.
3. Return `{ pin, children: snapshot }` as today.

RLS already allows tenant admins / unit leaders to insert notifications, which matches who operates the drop-off panel. No policy changes.

## Out of scope

- SMS / email delivery of the PIN (can be added later behind a tenant toggle).
- Changing PIN format, expiry, or hashing.
- Pickup-side notifications.
