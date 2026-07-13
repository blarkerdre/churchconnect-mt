## Add parent consent for children

Currently, the `children` table has no consent fields. When a parent adds a child in **My Family → Add child** (and via the Children Church intake), we need to capture explicit parental consent before that child can be checked in / photographed / receive pastoral contact — matching the GDPR consent pattern already used for adult members (`ConsentTogglesGroup`).

### 1. Database (migration)

Add nullable columns to `public.children`:
- `parental_consent_given boolean NOT NULL DEFAULT false` — required master consent by parent/guardian
- `parental_consent_at timestamptz` — timestamp when consent was given
- `parental_consent_by uuid` — member_id of parent who gave consent
- `consent_photos boolean NOT NULL DEFAULT false` — child may appear in service photos/videos
- `consent_pastoral_contact boolean NOT NULL DEFAULT true` — leaders may follow up re: child welfare
- `consent_medical_emergency boolean NOT NULL DEFAULT false` — permission to seek emergency medical care if parent unreachable
- `consent_notes text` — optional freeform (e.g. "no photos on social media")

Log each change into existing `consent_events` table with `subject_type = 'child'` and `subject_id = child.id` so we keep an audit trail (same pattern as member consent).

No RLS changes — the existing children policies already restrict to primary guardian + co-guardians + Children Church workers.

### 2. UI — My Family → Add / Edit child (`src/pages/MyFamily.jsx`)

Extend `ChildForm` with a new **Parental Consent** section (collapsible card at the bottom of the form) containing:
- Master toggle "I confirm I am the parent/legal guardian and give consent for this child's data to be held and processed" (**required to save**).
- Sub-toggles: Photos & media, Pastoral contact, Emergency medical care.
- Optional consent notes textarea.

Save behaviour:
- Block save if master consent is off (toast: "Parental consent is required").
- On save, stamp `parental_consent_at = now()` and `parental_consent_by = memberId` when consent transitions off → on.
- Insert a row into `consent_events` describing the change (grant/revoke, which flags).

Display on the child card in My Family: a small "Consent: ✓ given DD MMM YYYY" line, or a red "Consent required" pill if missing.

### 3. UI — Children Church check-in (`src/pages/ChildrenChurch.jsx`)

Block check-in for a child where `parental_consent_given = false`. Show a banner in the check-in row: *"Parent consent required — ask parent to complete consent in My Family before check-in."* Photo capture and photo display in the child roster respect `consent_photos = false` (hide/blur photo, show placeholder).

### 4. Out of scope

- No changes to adult member consent flow.
- No changes to guardians/delegations flow.
- No new tenant-level setting text (reuses existing tenant privacy policy URL via `useConsentText`).

### Files touched

- new migration adding columns to `public.children`
- `src/pages/MyFamily.jsx` — extend `ChildForm`, add consent display on card
- `src/pages/ChildrenChurch.jsx` — gate check-in + respect photo consent
- `src/integrations/supabase/types.ts` regenerates automatically after migration
