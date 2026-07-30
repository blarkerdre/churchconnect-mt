## What's happening

The "Registered preteens" dialog in Children Church → Preteens loads guardian details with an embedded lookup (`guardian:primary_guardian_member_id(...)`). That embed requires a foreign key from `preteens.primary_guardian_member_id` to `members.id`.

Verified in the database:
- `teens` has `teens_primary_guardian_member_id_fkey` → `members(id)`, so the equivalent Teens dialog works.
- `preteens` has **only** a primary key — no guardian foreign key at all.

So the preteens query fails on the relationship lookup and the dialog renders an empty list, even though a preteen record does exist (Demo Church has one active preteen registered to your member record).

## Fix

1. Add the missing foreign key on `preteens.primary_guardian_member_id` → `members(id) ON DELETE CASCADE`, matching the `teens` table exactly. (Any preteen rows pointing at a non-existent member would block this; the current data is clean.)
2. Re-open the Registered preteens dialog and confirm the record and guardian name/phone/email appear, and that search/filters and CSV export work.

No UI or query code changes are needed — the frontend is already written correctly against the relationship the `teens` table has.

## Technical notes
- Single migration adding one constraint; no RLS, grants, or policy changes (the `preteens_read` policy already allows admins, guardians and Children's Church members).
- Same-tenant integrity continues to be enforced by the existing `.eq("tenant_id", tenantId)` guards in the query.
