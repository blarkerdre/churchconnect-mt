## Goal

Let Children Church workers drop off and pick up children whose parents do **not** have an app account, while still keeping a proper safeguarding record. After pickup, optionally send the parent an invite link so next time the family is already in the system.

## What changes for the user

### 1. New "Walk-in registration" flow on the Drop-off screen

On the existing Drop-off card (`ChildrenChurch.jsx` → `CheckInPanel`), when the search returns no matches the worker sees a new button:

> **+ Register walk-in family**

Clicking it opens an inline mini-form:

- **Parent / guardian**
  - First name *
  - Last name *
  - Mobile phone (preferred)
  - Email (optional)
  - Relationship to child (Mum / Dad / Grandparent / Carer / Other)
  - Photo ID seen? (checkbox, worker confirmation)
- **Child** (repeatable — "+ Add another child")
  - First name *
  - Last name *
  - Date of birth or age group *
  - Gender (optional)
  - Allergies / medical notes (optional)
  - Notes for workers (optional)

Submit creates:
- a lightweight **member** row for the parent (no `user_id`, `membership_status = 'visitor'`, `source = 'children_church_walkin'`), and
- one **child** row per entered child, with `primary_guardian_member_id` pointing at that new member.

The form then drops the worker straight into the normal check-in step for that family, so the same 6-digit PIN flow issues a pickup code (printed/shown on screen — parent writes it down or photographs it).

### 2. Pickup for walk-ins

No change to the release flow. Walk-in children are released the same way:
- **PIN + adult** — adult dropdown lists the walk-in parent (and any other authorised adults added later).
- **Leader override** — still available for the edge case where the parent loses the PIN.

The "authorised adults" list for a walk-in child starts with just the walk-in parent; leaders can add more later from the child profile.

### 3. Optional "Invite parent to claim" action

In the **Currently in care** card and on the child profile dialog, walk-in families show a small **"Send claim invite"** button (visible to leaders/admins). It sends an SMS and/or email to the parent with a one-tap link that:
- Opens the existing public registration / sign-up page on the tenant.
- Pre-fills the parent's name, phone, email.
- On successful sign-up, attaches the new auth user to the existing walk-in member row (no duplicate created) and marks `source = 'claimed'`.

The invite link is single-use and expires after 14 days. If the parent never claims it, the walk-in member + child records stay exactly as they are and can be used again next service.

### 4. Reports

The CSV in `ReportPanel` gains one extra column **"Walk-in?"** (Yes/No) so leaders can see how many walk-in families used the service in the period.

## Out of scope

- No change to the existing PIN logic, leader override, delegation codes, or notifications.
- No bulk import of walk-ins.
- No payment / membership conversion logic — claiming only links the auth user to the member.
- No change to the parent self-service "My Family" page.

## Technical notes (for reference)

- **DB migration**:
  - `members`: add nullable `source TEXT` (values: `'children_church_walkin' | 'claimed' | null`) if not already present. Existing `membership_status = 'visitor'` is reused.
  - New table `member_claim_invites` (tenant-scoped, RLS): `id`, `tenant_id`, `member_id`, `token` (unique), `phone`, `email`, `expires_at`, `claimed_at`, `created_by`, `created_at`. GRANTs to `authenticated` (insert/select own-tenant) and `service_role` (all). Anon needs `SELECT` only by exact token via a SECURITY DEFINER RPC `claim_member(_token, _new_user_id)` — no broad anon select.
  - SECURITY DEFINER function `register_walkin_family(_parent jsonb, _children jsonb[])` that inserts the member + children atomically and returns the new IDs, scoped to the caller's tenant via `user_has_tenant_access`.
- **Edge function**: extend or add a small function `send-claim-invite` that calls `send-transactional-email` (new template `walkin-claim-invite`) and/or `send-sms` with the deep link `/<tenantSlug>/auth?claim=<token>`.
- **Frontend**:
  - `CheckInPanel`: add `WalkInRegisterDialog` component; on success set `selectedFamily` to the freshly created family object and continue existing flow.
  - `Auth.jsx`: if `?claim=<token>` is present, on successful sign-up call `claim_member` RPC, then redirect to dashboard with a toast.
  - `ReportPanel`: include `source` in select and CSV column.
- **Audit**: log `walkin_registered`, `claim_invite_sent`, `member_claimed` events via existing `logAudit` util.

## Open questions

1. Should the claim invite be **SMS only**, **email only**, or **worker chooses** at send time? (Default proposed: worker chooses, defaulting to whichever contact the walk-in parent provided.)
2. Should the **"Photo ID seen"** checkbox be **required** before issuing the PIN, or just recorded? (Default proposed: required for walk-ins only.)
