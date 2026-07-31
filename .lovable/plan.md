## Goal

Make the Audit tab in System Logs read as a plain-English trail: **who** did **what**, on **which record**, and **exactly when**.

## What exists today

System Logs already has an admin-only **Audit** tab reading `audit_log` (actor, action, entity_type, entity_id, details JSON, timestamp). The current card shows actor name, a raw action badge like `member_update`, the entity type, and only a few hand-picked detail fields — so most entries read as jargon and the affected record is often not shown. Timestamps show to the minute only.

## Changes (all in `src/pages/SystemLogs.jsx`)

1. **Plain-English sentence per entry**
   Render each row as: `Ada Obi updated member Test TEST — 31 Jul 2026, 09:41:22`.
   - Map actions to readable verbs (`member_update` → "updated member", `role_add` → "assigned role", `child_dropoff` → "dropped off", `join_request_approve` → "approved join request", `unit_task.created` → "created unit task", `certificate_issued` → "issued certificate", etc.), with a sensible fallback that de-underscores anything unmapped.
   - Derive the target name from whichever detail key is present (`member_name`, `target_name`, `child_name`, `title`, `tenant_name`, `certificate_number`, `email`), falling back to a short `entity_id`.

2. **Who** — keep the resolved actor name, add the actor's email as secondary text, and label system-generated rows (no `user_id`, or `details.source` set by an edge function) as "System".

3. **What changed** — for entries carrying `before`/`after` (member updates, tenant settings, transport status), show a compact "Field: old → new" list of only the keys that actually differ, expandable via a "View details" toggle that reveals the full JSON for anything not covered.

4. **Timestamp** — show date + time to the second, plus a relative hint ("2 hours ago"); CSV export already carries `yyyy-MM-dd HH:mm:ss`, extended with entity id and target name columns.

5. **Filtering** — action dropdown shows the friendly labels, add an entity-type filter and keep search working across actor name, target name and details. Widen the default date range from 7 to 30 days so the trail isn't empty on open.

## Technical notes

- Presentation-only: no schema change, no new audit writes, no RLS change. `audit_log` already stores everything needed (`user_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`).
- Action-label and target-name resolution go in small helper maps at the top of the file, so new action types degrade gracefully rather than breaking.
- Tab stays admin-only, as it is now.
