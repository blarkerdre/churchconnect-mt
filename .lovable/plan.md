## Goal
Add worker/leader names to the Children Church Report (table + CSV) so admins can see who handled each drop-off and pickup, and which leader authorised any override.

## Changes (Report panel only, `src/pages/ChildrenChurch.jsx` → `ReportPanel`)

1. **Extend the query** to resolve worker users (Children Church team members) to member names by joining `members` via `user_id`:
   - `dropoff_worker:members!child_checkins_dropoff_worker_user_id_fkey(...)` — if no FK exists, fetch worker user_ids separately and look up `members` (`first_name`, `last_name`) by `user_id` in a second lightweight query, then merge in memory.
   - Same for `pickup_worker_user_id`.
   - Also resolve `dropoff_parent_member_id` and `pickup_adult_member_id` to names (these already FK to `members`).

2. **Table columns** (after existing ones):
   - Drop-off by (worker)
   - Released by (pickup worker) — shown as **Leader (override)** in red/destructive badge when `pickup_method = 'leader_override'`
   - Collected by (pickup adult / delegation)
   - Override reason (truncated, full on hover) — only when present

3. **CSV export** — add columns: `dropoff_worker`, `pickup_worker`, `pickup_adult`, plus keep existing `override_reason`. Header row updated to match.

4. **No schema or business-logic changes.** Purely presentation: same RLS, same data source, no new mutations.

## Technical notes
- Workers are auth users, not members directly. Approach: fetch distinct `dropoff_worker_user_id` + `pickup_worker_user_id` from the result rows, then `supabase.from("members").select("user_id, first_name, last_name").in("user_id", ids).eq("tenant_id", tenantId)` and build a `Map`. Fallback to "Unknown" when a worker has no member record.
- Adult names: fetch via `.in("id", adultIds)` against `members`.
- All lookups are tenant-scoped.

## Out of scope
Drop-off/pickup UI, override workflow, PIN logic, schema changes.