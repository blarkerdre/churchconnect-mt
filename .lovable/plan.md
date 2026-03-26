
Fix the blank preview by hardening the recent shell changes in `src/components/AppLayout.jsx` and aligning tenant switching with the route-based tenant system.

### What I found
- `Auth.jsx` no longer has the earlier conditional-hook problem.
- The riskiest recent change is now in `AppLayout.jsx`, where tenant switching was changed to re-authenticate inside the layout.
- The current tenant switch flow only updates context with `switchTenant(...)` but does not navigate to the matching `/t/{tenantSlug}` URL, so app state and URL can drift apart.
- The password check also uses `profile?.email`, which is less reliable than the authenticated user’s email.

### Plan
1. **Stabilize `AppLayout.jsx`**
   - Make the layout safe even when tenant/profile data is still loading.
   - Add defensive fallbacks for header/title/tenant badge rendering so the shell never crashes on missing data.

2. **Refactor tenant switch confirmation**
   - Keep the password dialog UI, but make it use the authenticated user email from auth state instead of the profile record.
   - Ensure cancel/close fully resets pending switch state.

3. **Switch tenants by navigating, not only mutating context**
   - After successful password confirmation, redirect to the selected tenant’s prefixed route (for example `/t/lfc-cardiff` or `/t/demo-church-test`) so URL, branding, and tenant context stay in sync.
   - Keep the current path where possible, or safely fall back to that tenant’s dashboard.

4. **Guard against preview-only auth noise**
   - Avoid any auth re-check running outside the explicit confirmation action.
   - Keep initial page render independent from the tenant-switch dialog logic.

### Files to update
- `src/components/AppLayout.jsx`
- Possibly `src/contexts/TenantContext.jsx` only if a tiny helper is needed to resolve tenant slugs cleanly

### Expected result
- The preview should render again instead of showing a white screen.
- Tenant name remains visible across the app.
- Switching tenants still requires password confirmation, but now lands users on the correct tenant-prefixed URL without destabilizing the app.

### Technical note
The app is built around URL-scoped tenancy (`/t/:tenantSlug/*`). Any tenant switch implementation should follow that routing model, otherwise the selected tenant in state and the tenant in the URL can diverge and cause unstable behavior.
