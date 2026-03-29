

## Add "Worshipped at any other Winners Chapel International" Question

### Change

Add a new boolean question after the existing "Have you worshipped with us at {tenantName}?" question:

> "Have you worshipped with us at any other Winners Chapel International?"

This is a Yes/No switch, same pattern as the other questions. It needs a new DB column and updates to all form flows.

### Files to change

1. **1 database migration** — add `worshipped_at_other_wci boolean` nullable column to `members`
2. **`src/components/members/WelcomeQuestions.jsx`** — add new SwitchRow after the `worshipped_before` block (after line 57)
3. **`src/pages/PublicRegistration.jsx`** — add `worshipped_at_other_wci` to form state defaults
4. **`src/pages/MyProfile.jsx`** — add to form state defaults and RPC params
5. **`src/components/members/MemberFormDialog.jsx`** — add to form state defaults
6. **`supabase/functions/public-register/index.ts`** — include `worshipped_at_other_wci` in sanitized payload
7. **Update RPCs** (`update_own_member_profile`, `upsert_own_member_profile`) via migration to accept the new param

