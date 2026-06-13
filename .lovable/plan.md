## Goal
1. Show "Brought by" (the adult who dropped the child off) in the Children Church report — both the on-screen table and the CSV.
2. When a child is released at pickup, send an in-app notification to the parent(s).

## Changes — `src/pages/ChildrenChurch.jsx`

### 1. Report — "Brought by" column
The query already returns `_dropoff_parent_name`; CSV already includes it as `dropoff_parent`. Only the on-screen table is missing it.
- Add a new column header **"Brought by"** in the `ReportPanel` table, placed right after "Drop-off".
- Render `{r._dropoff_parent_name || "—"}` in each row.
- Rename the existing "Drop-off by" header to **"Drop-off worker"** so the two are unambiguous.
- Rename the CSV column header `dropoff_parent` → `brought_by` for clarity (data already populated).

### 2. Notify parents on pickup
In `PickupPanel`'s `release` mutation:
- After `supabase.rpc("release_child", args)` succeeds, look up the check-in row to get `child_id`, `pickup_at`, `pickup_method`, `pickup_adult_member_id` and the child's name + `primary_guardian_member_id`. Also pull `child_guardians` rows for that child to collect all linked adult member ids (best-effort safeguarding fan-out).
- Resolve those member ids → `user_id` via `members` (`.eq("tenant_id", tenantId)`).
- Insert one `notifications` row per distinct `user_id`:
  - `type: "children_church"`, `reference_type: "children_church"`, `reference_id: checkin.id`
  - title: `"{Child first name} has been picked up"`
  - message: includes pickup time (HH:mm), method (PIN / delegation code / leader override), and the collecting adult's name when available.
  - For `leader_override`, prefix the message with "Leader override:" and include the worker's name.
- All inserts include `tenant_id`. Wrap in try/catch — toast still says "Child released" even if notify fails (logged via `console.warn`).

## Out of scope
- No schema changes — `dropoff_parent_member_id` and `notifications` already exist.
- No email/SMS/push — in-app notifications only (matches existing PIN-issue notification pattern).
- No changes to release RPC or business rules.
