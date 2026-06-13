## Children Church — Secure Drop-off & Pickup

A new module under the Children Church unit that lets parents register their children, hands them over to a Children Church worker at drop-off, and ensures only authenticated, authorised adults can collect them after service. Every action is timestamped and logged for the unit leader's report.

### 1. Data model (new tables, all tenant-scoped with RLS)

- **`children`** — child profile
  - parent fields: `primary_guardian_member_id` (required), `date_of_birth`, `gender`, `allergies`, `notes`, `photo_url`, `age_group` (Nursery / Toddler / Primary / Pre-Teen)
- **`child_guardians`** — many-to-many of children ↔ authorised adults
  - `child_id`, `member_id`, `relationship` (Parent, Grandparent, Aunt/Uncle, Family friend, Other), `can_pickup` boolean
  - unique on (child_id, member_id)
- **`child_pickup_delegations`** — one-time codes issued by a parent when someone outside the authorised list must collect (e.g. neighbour collecting today only)
  - `child_id`, `issued_by_member_id`, `delegate_name`, `delegate_phone`, `code_hash`, `valid_on` (date), `expires_at`, `used_at`
- **`child_checkins`** — one row per drop-off / pickup pair
  - `child_id`, `service_date`, `dropoff_at`, `dropoff_worker_user_id`, `dropoff_parent_member_id`, `pickup_at`, `pickup_worker_user_id`, `pickup_adult_member_id` (nullable when delegation used), `pickup_delegation_id` (nullable), `pickup_method` (qr | pin | delegation_code | leader_override), `pin_code_hash`, `notes`, `status` (checked_in | picked_up | flagged)

Triggers: audit_log entries for every check-in, pickup, override, and delegation use.

### 2. Authentication & authorisation rules (enforced in DB + edge function)

- **Drop-off**: any active Children Church unit member scans the parent (QR from parent's app, or selects from member list) → selects child(ren) → confirm. System issues a 6-digit pickup PIN shown to parent and stored hashed.
- **Pickup**: worker opens the child's record, then either
  - **QR**: scans the authorised adult's app QR (rotating token bound to user_id + child_id allow-list)
  - **PIN**: enters the 6-digit PIN given at drop-off — must match AND the adult presenting must be on `child_guardians.can_pickup` OR present a valid delegation code
  - **Delegation code**: one-time code shown to the delegate adult (by parent via share-sheet); worker enters code + delegate's name/phone, system validates and marks `used_at`
- **Leader override**: unit leader can release with a justification note; row is marked `flagged` and a notification fires to admins and the primary guardian
- No path allows release without a server-side authorisation check — the edge function `child-release` is the single gatekeeper

### 3. New edge functions
- `child-release` — validates QR token / PIN / delegation, records pickup, writes audit + notification
- `child-checkin` — validates parent identity + child membership in unit roster, records dropoff, issues PIN
- `child-pickup-token` — issues a short-lived (60s) signed QR payload for an authorised adult's phone

### 4. UI

- **My Family** (parent view, in profile menu): list of children, add/edit child, manage authorised guardians (search tenant members), generate one-time delegation code with date and SMS/WhatsApp share, view today's PIN/QR while child is checked in
- **Children Church → Check-In Desk** (worker view, mobile-first): scan parent QR or search by name → confirm children → show PIN to parent on screen
- **Children Church → Pickup Desk** (worker view): scan adult QR, enter PIN, or enter delegation code; shows child photo + authorised adults list for visual confirmation
- **Currently In Care** dashboard: live list of checked-in children with elapsed time
- **Reports** (unit leader / admin): per service date, weekly, monthly — totals, average stay, late pickups, by age group, flagged events; CSV + Print

### 5. Permissions
- Parents: read/write their own children, guardians, delegation codes; read their own check-in history
- Children Church unit members: read all children, perform check-in and pickup (release goes through `child-release`)
- Unit leaders + admins: leader override release; access to Reports
- Standard `tenant_id` scoping on every table and every query

### 6. Notifications (uses existing notifications + push pipeline)
- Drop-off confirmed → parent push + in-app
- Pickup completed → parent push + in-app with adult's name and timestamp
- Flagged / override → primary guardian + admins
- Still in care 15 min after service end → parent reminder

### 7. Out of scope
- Photo capture of pickup adult (can add later)
- Hardware barcode scanners — uses phone camera
- Billing / fees
- Visiting (non-member) children — covered only via delegation flow; first-time visitor children must be quick-registered by the worker before drop-off

### Files to add
- migration: `children`, `child_guardians`, `child_pickup_delegations`, `child_checkins` with GRANTs, RLS, triggers, audit
- edge functions: `child-checkin`, `child-release`, `child-pickup-token`
- pages: `src/pages/ChildrenChurch.jsx`, `src/pages/MyFamily.jsx`
- components: `src/components/childrenchurch/{CheckInDesk,PickupDesk,ChildFormDialog,GuardianManager,DelegationCodeDialog,PickupQR,InCareList,ChildrenChurchReport}.jsx`
- nav: sidebar entry for Children Church (visible to unit members + admins); "My Family" entry on profile menu (visible to all members)
- memory: add `mem://features/children-church`
