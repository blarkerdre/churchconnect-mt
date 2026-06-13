## Problem
The `checkin_child` RPC rejects workers with the error "Only Children Church workers can check in" because `is_children_church_member` only recognises units literally named "Children Church", "Childrens Church", or "Children's Church". The tenant's unit is called "Children", so valid workers are denied.

## Fix
Update the `is_children_church_member` and `is_children_church_leader` database functions to also match the aliases:
- `children`
- `children ministry`
- `childrens ministry`
- `children's ministry`

Matching stays case-insensitive and trim-safe (`lower(btrim(...))`). The functions continue to check both the member's `church_unit` CSV field and `unit_leader_assignments.unit_name`.

## Migration
A single SQL migration will redefine both functions with the expanded alias lists. No table changes, no RLS changes, no UI changes.

## Verification
After applying, `SELECT public.is_children_church_member('<user_id>', '<tenant_id>')` should return `true` for members of the "Children" unit, and the Check-in tab will successfully issue PINs.