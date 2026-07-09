## Goal
Automatically enroll members into three system church units based on their role/assignment, while still letting admins add/remove manually.

- Role `unit_leader` → joins **"Unit Leader"** church unit
- Role `wsf_leader` → joins **"Home Cell Leader"** church unit
- Set as House Provider (`wsf_centres.host_member_id`) → joins **"House Provider"** church unit

## Approach

Membership in a church unit is stored as a comma-separated string on `members.church_unit`. The three names above become normal rows in `church_units` per tenant (created on demand), so admins can already toggle them from the member form — that satisfies the "admin can add/remove" requirement without extra UI.

Automatic joining is done in the database via triggers, so it works uniformly whether the role/host is assigned from User Management, the WSF Centre dialog, bulk operations, or a future edge function.

### Data changes (single migration)

1. Seed the three units for every existing tenant (idempotent `INSERT ... ON CONFLICT DO NOTHING`):
   - `Unit Leader`, `Home Cell Leader`, `House Provider` — `is_active = true`.
2. Helper functions (SECURITY DEFINER, `search_path = public`):
   - `ensure_church_unit(_tenant uuid, _name text)` — inserts the unit if missing.
   - `add_member_unit(_member uuid, _unit text)` — appends `_unit` to `members.church_unit` if not present (case-insensitive), preserving other units.
   - `remove_member_unit(_member uuid, _unit text)` — removes `_unit` from `members.church_unit`, keeping the rest.
3. Triggers:
   - **On `user_roles`** (AFTER INSERT / AFTER DELETE): resolve the member row via `members.user_id = NEW.user_id AND tenant_id = NEW.tenant_id`; if `NEW.role = 'unit_leader'` add/remove "Unit Leader"; if `'wsf_leader'` add/remove "Home Cell Leader". Ensure the unit exists first.
   - **On `wsf_centres`** (AFTER INSERT / UPDATE / DELETE): when `host_member_id` changes, remove "House Provider" from the previous host (if that member is no longer host of any active centre) and add it to the new host. On DELETE, clean up the departing host.
4. Backfill (one-time inside the same migration):
   - For every existing `user_roles` row with role `unit_leader` / `wsf_leader`, add the matching unit.
   - For every current `wsf_centres.host_member_id`, add "House Provider".

### Admin override

No code change needed — the three units appear in the normal Church Units list and in `MemberFormDialog`'s unit picker, so admins can add or remove them per member manually. The triggers only auto-add on role/host assignment; they only auto-remove when the underlying role or host link is removed. A manual removal by admin sticks until the role/host is re-assigned.

### Out of scope

- No UI changes.
- No changes to `church_unit` storage shape (still comma-separated string).
- No RLS changes; existing member-update policies already cover admin edits.

## Technical notes

- Case-insensitive matching when adding/removing to avoid duplicates like "unit leader, Unit Leader".
- The `wsf_centres` trigger checks whether the previous host still hosts any other active centre before removing the badge, so hosting multiple centres works.
- Triggers use `SECURITY DEFINER` because they touch `members` from a `user_roles` context; `search_path` is pinned to `public`.
- All auto-created units are marked `is_active = true` and tenant-scoped.
