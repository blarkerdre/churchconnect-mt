## Add parental consent to walk-in family registration

The `WalkInRegisterDialog` in `src/pages/ChildrenChurch.jsx` currently creates a visitor parent + child records without capturing parental consent, so newly-registered walk-in children fail the `parental_consent_given` gate we just added and cannot be checked in.

### 1. UI — `WalkInRegisterDialog` (`src/pages/ChildrenChurch.jsx`)

Add a **Parental Consent** block to the dialog (below the Children section, before the footer), mirroring the pattern used in My Family:

- Master toggle: *"I confirm I am the parent/legal guardian and give consent for these children's data to be held and processed"* — **required to submit** (block with toast if off).
- Sub-toggles: Photos & media, Pastoral contact, Emergency medical care.
- Optional consent notes textarea.
- Consent applies to **all** children being registered in this dialog (single family, single parent present).
- Include a short line linking to the tenant Privacy Policy via `useConsentText` (already imported pattern).

State additions in the dialog: `consent = { given, photos, pastoral, emergency, notes }` with sensible defaults (`pastoral: true`, others `false`).

Reset consent along with the rest of the form.

### 2. RPC — `register_walkin_family`

Extend the SECURITY DEFINER function (migration) to accept a `_consent jsonb` parameter and stamp the new consent columns on every inserted child row:

- `parental_consent_given` ← `_consent->>'given'` (bool, required true; raise if false)
- `parental_consent_at` ← `now()`
- `parental_consent_by` ← `v_member_id` (the parent member just created/matched)
- `consent_photos`, `consent_pastoral_contact`, `consent_medical_emergency` ← from `_consent`
- `consent_notes` ← from `_consent`

Also insert one row per child into `consent_events` (`subject_type = 'child'`, `subject_id = v_child_id`, `action = 'grant'`, `flags` = jsonb of the toggle state) for the audit trail. Keep GRANT EXECUTE to `authenticated`.

The client passes the new `_consent` payload in the `supabase.rpc("register_walkin_family", …)` call.

### 3. Out of scope

- No change to My Family consent flow (already implemented).
- No change to child check-in gating (already respects `parental_consent_given`; walk-in children will now pass because consent is captured at registration).
- No change to `child_guardians` / delegation flow.

### Files touched

- new migration replacing `public.register_walkin_family` with the `_consent jsonb` signature + `consent_events` inserts
- `src/pages/ChildrenChurch.jsx` — extend `WalkInRegisterDialog` state, UI, submit payload
- `src/integrations/supabase/types.ts` regenerates automatically
