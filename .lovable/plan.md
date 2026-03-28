
Fix the real cause of the non-2xx error for `mayodare@gmail.com` and harden tenant isolation in the onboarding/profile flows.

What I found:
- `mayodare@gmail.com` already has a `profile` and a `tenant_membership`, but has no `members` row yet.
- In `src/pages/MyProfile.jsx`, when no member is found, the page renders `CreateMemberProfile`.
- That create form still calls `supabase.functions.invoke("public-register")`.
- `public-register` is the public registration pipeline, not the authenticated self-service profile pipeline. It includes rate limiting, welcome email, follow-up side effects, and stricter validation. That is why “update my profile” can still fail with a non-2xx response.
- This is not just one user’s issue. Any tenant user with a profile + membership but no member row can hit the same path.
- There is also a tenant-isolation weakness in `public-register`: its “find linked member” and “claim by email” lookups are not tenant-scoped, which can misbehave once a user belongs to multiple tenants.

Implementation plan:
1. Add a dedicated authenticated member upsert path
   - Create a backend RPC/function such as `upsert_own_member_profile(...)`.
   - It should:
     - require `auth.uid()`
     - require a valid tenant context
     - only act inside that tenant
     - update the caller’s member row if it exists for that tenant
     - otherwise claim one unlinked same-tenant member by email, or create a new same-tenant member row
   - Keep it `SECURITY DEFINER` so it can safely bypass RLS while enforcing tenant/user checks in code.

2. Rewire My Profile to use the new authenticated path
   - In `src/pages/MyProfile.jsx`, replace the `public-register` call inside `CreateMemberProfile`.
   - Use the new authenticated upsert for first-time profile completion.
   - Keep normal edits on the existing self-update RPC, or unify both create/update flows onto the new RPC for consistency.

3. Harden tenant isolation in `public-register`
   - Keep `public-register` for public registration only.
   - Scope all member lookups by `tenant_id`:
     - linked member lookup
     - email claim lookup
   - Prevent cross-tenant claim/update behavior.

4. Improve error visibility
   - Return clearer backend error messages from the new authenticated profile path.
   - Add minimal request-level logging so future failures show the actual branch and reason instead of only “booted”.

5. Do a focused auth/profile flow audit
   - Verify tenant slug propagation on tenant auth routes.
   - Verify profile creation works for:
     - invited signup
     - tenant-route signup
     - existing authenticated user completing profile
     - existing member editing profile
   - Ensure all React Query keys remain tenant-scoped.

6. Clean up the obvious UI warning found during review
   - Fix the `Badge` nested inside `<p>` issue in `MemberDashboard` to remove the DOM nesting warning.

Files likely to change:
- `src/pages/MyProfile.jsx`
- `supabase/functions/public-register/index.ts`
- one new database migration for the authenticated upsert function
- `src/components/dashboard/MemberDashboard.jsx`

Expected result:
- `mayodare@gmail.com` can complete profile creation without hitting the public edge function path.
- Existing users update their profile without non-2xx edge-function errors.
- Public registration still works.
- Member linking/updating remains isolated per tenant, avoiding cross-tenant collisions.
