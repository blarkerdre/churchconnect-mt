## Goal
Allow admins to delete follow-ups from the Follow-ups page.

## Changes (single file: `src/pages/Followups.jsx`)

1. **Delete mutation**
   - Add `deleteMutation` that runs `supabase.from("followups").delete().eq("id", id).eq("tenant_id", tenantId)`.
   - Best-effort cleanup first of child rows scoped by `tenant_id`: `followup_referrals`, `followup_referral_updates` (via referral ids), and `followup_scheduled_messages` for that `followup_id`, so the parent delete succeeds regardless of FK config.
   - Invalidate `["followups"]`, close detail panel if the deleted row was selected, toast success/error.

2. **Row action (admin only)**
   - In the list card, add a small Trash icon button in the top-right of each row, gated on `isAdmin`.
   - `onClick` with `e.stopPropagation()` and `window.confirm("Delete this follow-up? This cannot be undone.")` → `deleteMutation.mutate(f.id)`.

## Out of scope
- No schema/RLS changes (existing admin policies allow delete).
- No changes to edit, convert-to-member, filters, CSV/print, messaging, or detail panel.
- Non-admins keep current view.
