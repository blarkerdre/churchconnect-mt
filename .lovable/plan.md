
Goal: make Test and Live unmistakably different in the app, because the backend data is already different but the current UX hides that.

What I found
- The environments are not actually sharing the same data:
  - Test has TEST-only notifications and different tenant records.
  - Live has a single tenant: `LFC Cardiff`.
- The confusion comes from app behavior:
  1. Test currently has inconsistent tenant setup (`Demo Church (TEST)` plus another tenant `LFC Cardiff_Test`)
  2. Authenticated pages can be used without a tenant-prefixed URL, so both environments can feel visually identical at `/`
  3. The environment badge exists, but it is subtle
  4. Tenant switching does not update the URL, so the visible route does not clearly show which tenant/context is active

Plan
1. Clean up the Test tenant setup
- Keep one obvious Test tenant only
- Rename/standardize it with a clearly different slug, e.g. `demo-test`
- Remove or archive the extra preview tenant (`LFC Cardiff_Test`) so Test cannot resemble Live
- Re-scope the seeded preview data so it all belongs to the single Test tenant

2. Make tenant URLs canonical after login
- Add a redirect so authenticated users are always pushed to `/t/:tenantSlug/...`
- If a user opens `/members`, they should automatically land on `/t/demo-test/members` in Test and `/t/lfc-cardiff/members` in Live
- This makes the active environment/tenant visible in the URL immediately

3. Fix tenant switching to update the route
- Update `switchTenant` so it navigates to the selected tenant’s URL instead of only changing in-memory state
- Preserve the current page when switching tenants (for example, `/members` stays `/members` under the new tenant slug)

4. Add a stronger environment indicator
- Replace the small header badge with a persistent admin-visible banner/ribbon that clearly says `TEST ENVIRONMENT` or `LIVE ENVIRONMENT`
- Include the active tenant name in the same area
- Use stronger styling so preview cannot be mistaken for live

5. Add a quick verification path
- Ensure there is one obvious visual/data marker in Test only, such as:
  - tenant name includes `(TEST)`
  - a test announcement
  - test members with clear names
- Then verify that the same marker does not exist in Live

Technical notes
- `TenantContext` already reads the URL slug, so canonical tenant routing fits the current architecture cleanly
- `useNavigate` is already imported in `TenantContext`, which supports implementing route-aware tenant switching
- `AppLayout` already has environment helpers; I would build on that rather than creating a second environment system
- No new backend model is needed; this is mainly:
  - preview data cleanup
  - route behavior fixes
  - stronger environment UI

Expected result
- Test will open under a visibly test-only tenant URL and branding
- Live will open under its production tenant URL
- Switching tenants will change the URL
- The UI will clearly announce whether you are in Test or Live
- The two environments will no longer feel identical even when the same user account is used in both
