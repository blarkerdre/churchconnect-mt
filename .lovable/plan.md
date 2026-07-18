## Goal
Give Teens Church unit **leaders** a way to see every registered teen in the tenant (not just those in their own family).

## Where
`src/pages/TeensAttendance.jsx` — same page where leaders already manage sessions, cumulative reports, and pending self-enrolments. This keeps all leader-only tools in one place.

## Changes

1. **New "Registered Teens" button** in the header action row, shown only when `canManage` (leader) is true — next to "Cumulative report".

2. **New `RegisteredTeensDialog` component** in the same file:
   - Fetches all teens for the tenant (`teens` table, `tenant_id = tenantId`, ordered by name), including: name, gender, date of birth, `attendance_consent`, `is_active`, `access_pin_hash` (only to display a "PIN set" badge), primary guardian join `members(first_name, last_name, phone, email)`.
   - Search box (filter by teen name or guardian name).
   - Filter chips: All / Consent given / Consent needed / Inactive.
   - Each row shows: teen name, age (from DOB), gender, guardian name + contact, badges for Consent / PIN set / Inactive.
   - "Export CSV" button (name, DOB, gender, guardian, guardian phone, guardian email, consent, active).
   - Read-only — no edit/delete here (guardians manage their own teens in My Family).

3. **RLS check (verification step, not a change unless needed).**
   The existing roster dialog already selects across all teens in the tenant, so leaders can read them. Before shipping I'll run a quick `supabase--read_query` against `pg_policies` for `public.teens` to confirm that Teens unit leaders (or a broader authenticated-tenant policy) can `SELECT` all rows. If reads are actually restricted to guardians only and the roster works by another path, I'll add a scoped SELECT policy for Teens unit leaders using the existing `unit_leader_assignments` pattern (same "Teens/Teen/Teenagers/Youth" name matching used in `useTeensUnitRole`).

## Out of scope
- No changes to guardian-side `TeensSection` in My Family.
- No edit/delete of other families' teens by leaders (privacy).
- No changes to attendance flow, QR, or consent logic.

## Technical notes
- Reuse `useTeensUnitRole()` → `isLeader` for gating (matches existing `canManage`).
- Reuse existing dialog / Badge / CSV patterns from `CumulativeReportDialog` for consistency.
