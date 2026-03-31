

## Fix: Profile Update Error — Multiple `update_own_member_profile` Overloads

### Root cause
There are **5 overloads** of `update_own_member_profile` in the database with overlapping signatures (15, 24, 25, 34, and 34 parameters). When the client calls with 25 parameters, PostgreSQL cannot resolve which overload to use because two 25-param versions exist with near-identical signatures (one casts `gender`/`membership_status` as enum types, the other as `text`). This causes a "could not find function" or ambiguous function error.

### Fix
Drop all 5 overloads and create a single canonical `update_own_member_profile` that includes all fields the client might send, matching the full parameter list (including welcome-question fields like `_worshipped_before`, `_worshipped_at_other_wci`, etc.).

**1. Migration** — Drop all existing overloads, create one definitive function:
- Parameters: `_member_id uuid` + all 34 optional fields (personal, spiritual, welcome questions)
- Uses `text` types for `_gender` and `_membership_status` with safe casting
- Security definer, scoped to `auth.uid()` ownership check

**2. `src/pages/MyProfile.jsx`** — Update `buildOwnMemberProfilePayload` to include the missing welcome-question fields:
- Add `_worshipped_before`, `_worshipped_when_where`, `_would_like_to_join`, `_live_work_in_city`, `_how_did_you_hear`, `_attended_foundation_school`, `_wofbi_highest_level`, `_baptized_by_immersion`, `_preferred_contact_modes`, `_worshipped_at_other_wci`
- All default to `null` so existing callers don't break

### Files changed
- 1 new migration — drop old overloads, create single canonical function
- `src/pages/MyProfile.jsx` — extend `buildOwnMemberProfilePayload` with all fields

