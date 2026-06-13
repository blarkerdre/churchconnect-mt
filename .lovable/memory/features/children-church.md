---
name: Children Church
description: Secure parent drop-off / pickup with PIN, authorised adults list, one-time delegation codes, leader override, and reporting
type: feature
---
Tables: `children` (primary_guardian_member_id required), `child_guardians` (many-to-many of children ↔ authorised member adults, can_pickup), `child_pickup_delegations` (single-use codes valid for a date, code_hash = sha256(UPPER(code)+"|"+child_id)), `child_checkins` (status: checked_in|picked_up|flagged).

Server-side gatekeepers (RPC, SECURITY DEFINER):
- `checkin_child(_child_id, _pin, _parent_member_id)` — only Children Church unit members or admins. Stores `pin_code_hash = sha256(pin+"|"+checkin_id)`.
- `release_child(_checkin_id, _method, _pin, _adult_member_id, _delegation_code, _override_reason, _notes)` — methods: pin | qr | delegation_code | leader_override. PIN/QR require adult on `child_guardians` with can_pickup; delegation requires valid_on=service_date and consumes the row; leader_override requires `is_children_church_leader` or admin AND a reason, and marks the row `flagged`.

UI: `/children-church` (Check-in / Pickup / Report tabs, sidebar gated by Children Church unit membership or admin). `/my-family` (parents add children, manage authorised adults, generate one-time codes — available to all members on sidebar).

Audit: `audit_child_checkin_change` trigger logs `child_dropoff`, `child_pickup`, `child_pickup_flagged` via `write_audit`.

Unit name matching is case-insensitive: 'children church', 'childrens church', 'children's church'.
