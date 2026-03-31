

## Fix: "Could not find function" Error on Registration/Profile Save

### Root cause
There are 3 overloads of `upsert_own_member_profile` in the database, but none of them accepts both `p_tenant_id` and `p_worshipped_at_other_wci` together. The code in `MyProfile.jsx` passes both parameters, so PostgreSQL cannot resolve which function to call and returns "could not find function".

Current overloads:
1. `(p_tenant_id, ..., p_gdpr_consent)` — no welcome question fields
2. `(p_first_name, ..., p_worshipped_at_other_wci)` — no tenant_id
3. `(p_tenant_id, ..., p_preferred_contact_modes)` — has tenant_id + welcome questions but missing `p_worshipped_at_other_wci`

The client code sends: `p_tenant_id` + all welcome questions including `p_worshipped_at_other_wci` — this signature matches none of the 3 overloads.

### Fix
1 database migration to:
- Drop the 2 outdated overloads (signatures 1 and 3 above)
- Update overload 2 to include `p_tenant_id` as the first parameter AND `p_worshipped_at_other_wci`, matching exactly what the client sends

This creates a single canonical function with the full parameter list that the client expects.

### Files changed
- 1 new migration — drop old overloads, create/replace the definitive `upsert_own_member_profile` with all parameters including `p_tenant_id` and `p_worshipped_at_other_wci`

