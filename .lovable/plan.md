## Plan

1. **Remove the recursive Children Church access path**
   - Update row-level access rules so `children` no longer checks `child_guardians` directly from a `children` policy.
   - Keep parents able to see linked children, but move that check into a safe security-definer helper that bypasses recursive policy evaluation.

2. **Preserve tenant-scoped visibility**
   - Admins, tenant owners/admins, reports officers, and Children Church workers can see all children/check-ins for their active tenant.
   - Parents only see children where they are the primary guardian or are linked as a parent/guardian.
   - All access remains tenant-scoped; no cross-tenant exposure.

3. **Fix related child tables if needed**
   - Adjust `child_guardians` and `child_checkins` policies where they currently read `children` in a way that can trigger recursion.
   - Use the same safe helper functions instead of direct policy-to-policy table lookups.

4. **Add missing Data API grants**
   - Restore explicit access grants for `children`, `child_guardians`, and `child_checkins` to authenticated users and backend service role, matching the existing RLS restrictions.

5. **Validate after migration**
   - Run read checks for `children`, `child_guardians`, and `child_checkins` policies.
   - Confirm the app query no longer returns `infinite recursion detected in policy for relation "children"`.