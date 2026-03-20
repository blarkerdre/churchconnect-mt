

## Plan: Prefill profile form with signup data and use "Update My Profile"

### Problem
When a logged-in user with no linked member record visits My Profile, the form shows empty fields and says "Create My Profile". It should prefill with their signup data (name, email) and say "Update My Profile".

### Changes

**1. Update `CreateMemberProfile` in `src/pages/MyProfile.jsx`**
- Rename title from "Complete Your Member Profile" / "Create My Profile" to "Update My Profile"
- Prefill `first_name` and `last_name` by splitting `user.user_metadata.full_name` (from signup)
- Prefill `email` from `user.email` (already done)
- Change the submit button text from "Create My Profile" to "Update My Profile"
- Instead of doing a direct `supabase.from("members").insert(...)`, call the `public-register` edge function which already handles creating or claiming member records for authenticated users, and passes the auth token so the backend links the record properly

**2. Drop the RLS INSERT policy "Users can create own member record"**
- Database migration to remove the policy that allows `INSERT` where `auth.uid() = user_id`
- The edge function uses the service role key, so it bypasses RLS — no client-side insert needed
- This hardens security: members cannot insert arbitrary records via the client

### Files affected
- `src/pages/MyProfile.jsx` — prefill form, rename labels, use edge function for submission
- Database migration — drop the self-insert RLS policy on `members`

