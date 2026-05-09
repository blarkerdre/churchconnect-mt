## Database integrity audit — findings

### 1. Unlinked members (`user_id IS NULL`)

| Tenant | Linked | Unlinked | Total |
|---|---|---|---|
| wci-cardiff | 84 | **22** | 106 |
| demo-test | 6 | **15** | 21 |
| wci-croydon | 3 | 0 | 3 |

- **35 unlinked members across the system have an email** on file (20 in WCI Cardiff, 15 in Demo) — these are good candidates for an automated email-based backfill via the existing `auto_link_member_by_email` function.
- **20 profiles exist with no matching member row** — these are auth users who signed up but were never linked to a member record (the welcome flow likely missed them, or their email differs from the member email on file).
- ✅ **0** members have `user_id` set without a corresponding `tenant_memberships` row — that part is healthy.

### 2. Tenant scoping integrity

| Check | Count |
|---|---|
| `members.tenant_id IS NULL` | **1** (OGHENEKARO PRECIOUS IJOMONE — `karoijomone@gmail.com`) |
| `profiles.tenant_id IS NULL` | **1** (`easyty2008@gmail.com`) |
| `attendance_sessions.tenant_id IS NULL` | 0 ✅ |
| `attendance_records.tenant_id IS NULL` | 0 ✅ |
| `tenant_memberships.tenant_id IS NULL` | 0 ✅ |
| Profiles whose `tenant_id` differs from any of their `tenant_memberships` | **3** (cross-tenant drift — likely users who switched tenants) |

### 3. Today's attendance sessions (2026-05-09)

5 sessions exist for today; relevant for the check-in widget bug:

| Tenant | Title | Type | Unit | Status |
|---|---|---|---|---|
| wci-cardiff | LEADERSHIP EMPOWERMENT SUMMIT MAY 2026 | Other | *(none)* | open |
| wci-cardiff | WORKERS MEETING MAY 2026 | Other | *(none)* | open |
| wci-cardiff | LEADERSHIP EMPOWERMENT SUMMIT MAY 2026 | Other | *(none)* (duplicate) | open |
| wci-cardiff | LEADERSHIP EMPOWERMENT SUMMIT MAY 2026 | Unit Meeting | WORKERS MEETING | open |
| demo-test | test3 | Unit Meeting | Choir | open |

Issues:
- **Duplicate "LEADERSHIP EMPOWERMENT SUMMIT MAY 2026"** exists 3 times in WCI Cardiff (2× Other + 1× Unit Meeting). Members will see it 3 times in the widget.
- The Unit Meeting variant is scoped to unit `WORKERS MEETING`, but `WORKERS MEETING` is a meeting name, not a real church unit. No member's `church_unit` will match this, so no one is eligible to self check-in to that row.

## Proposed fixes

These are **data fixes only** (no code changes). All run as migrations or insert-tool updates, scoped per tenant.

### Fix A — Backfill `user_id` for members where email matches a profile/auth user
Run a one-off SQL update for each tenant:

```sql
UPDATE members m
SET user_id = p.user_id, updated_at = now()
FROM profiles p
WHERE m.user_id IS NULL
  AND m.tenant_id = p.tenant_id
  AND lower(btrim(m.email)) = lower(btrim(p.email))
  AND NOT EXISTS (
    SELECT 1 FROM members m2
    WHERE m2.user_id = p.user_id AND m2.tenant_id = p.tenant_id
  );
```

Expected to recover most of the 35 unlinked-with-email rows.

### Fix B — Assign `tenant_id` to the 2 orphaned rows
- Member `OGHENEKARO PRECIOUS IJOMONE` → assign to a tenant (likely `wci-cardiff`; please confirm).
- Profile `easyty2008@gmail.com` → assign based on their `tenant_memberships` row if one exists, otherwise delete.

### Fix C — Clean up duplicate sessions for today (WCI Cardiff)
- Keep one "LEADERSHIP EMPOWERMENT SUMMIT MAY 2026" (Other, no unit) and delete the other two duplicates.
- For the Unit Meeting variant scoped to `WORKERS MEETING`: either delete it, or set its `unit` to the actual unit (e.g. `Workers`) so eligible members can check in.

### Fix D — Reconcile 3 cross-tenant profile drifts
List the 3 affected users and either:
- Update `profiles.tenant_id` to match their primary `tenant_memberships`, OR
- Leave as-is (this drift is mostly cosmetic — RLS uses `tenant_memberships`, not `profiles.tenant_id`).

## What I need from you before applying fixes

1. **Fix A** — safe to run automatically? (high confidence, only links where emails exactly match)
2. **Fix B** — which tenant should `OGHENEKARO PRECIOUS IJOMONE` belong to?
3. **Fix C** — delete the two duplicate sessions and fix the unit on the third?
4. **Fix D** — reconcile drift, or skip?

Confirm which fixes (A/B/C/D) to apply and I'll generate the migrations.
