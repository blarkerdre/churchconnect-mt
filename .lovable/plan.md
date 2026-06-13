## Goal
1. Let a parent permanently delete one of their children from "My Family".
2. Give Children Church workers (unit members and leaders) a way to view a child's full profile in the Children Church page.

## Current state
- DB already allows it:
  - `children` DELETE policy: primary guardian or admin.
  - `children` SELECT policy: primary guardian, `is_children_church_member`, or admin.
- No UI today exposes either capability.

## Changes (frontend only — no DB migration)

### 1. Parent delete child — `src/pages/MyFamily.jsx`
- Add a small destructive "Delete" button on each child card (next to Edit / Authorised adults / One-time code).
- Confirm via an AlertDialog ("Delete {name}? This permanently removes the child and their guardians, delegations, and check-in history references.").
- On confirm: `supabase.from("children").delete().eq("id", child.id).eq("tenant_id", tenantId)`.
- Block deletion if the child currently has an active check-in (`activeCheckins` already loaded) — show a toast asking to release first.
- Invalidate `my-children` query and toast success.

### 2. Children Church worker — view child profile — `src/pages/ChildrenChurch.jsx`
- Add a new `ChildProfileDialog` component (in the same file, consistent with the existing dialogs).
- Loads: child record (name, DOB, age group, gender, allergies, medical notes, notes, photo), primary guardian (member name + phone/email), authorised adults from `child_guardians` joined to `members`, and the latest 5 check-in history rows from `child_checkins`.
- Trigger points (worker-only — page is already gated to `is_children_church_member` / leader):
  - Family search results: make each child chip clickable to open the profile dialog.
  - "In care" list: add an "View profile" icon button on each row.
- All queries scoped with `.eq("tenant_id", tenantId)` per multi-tenant rules. RLS already permits the read.

## Out of scope
- No schema or policy changes.
- No changes to check-in/release logic, PINs, or delegation codes.
- No bulk delete, no soft-delete/archive (hard delete per request).
- Admin-side child deletion UI (parents only for now).
