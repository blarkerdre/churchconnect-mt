

## Make Auth Emails and Links Tenant-Scoped

### Problem
Currently, auth emails (signup confirmation, password reset, magic link) and the welcome registration email all hardcode "Winners Chapel International Cardiff" branding and use generic URLs. In a multi-tenant system, each tenant should see their own church name, and verification/reset links should route to the tenant-scoped auth page (`/t/:tenantSlug/auth`).

### Changes

#### 1. `src/hooks/useAuth.jsx` — Pass tenantSlug to resetPassword
- Update `resetPassword` to accept an optional `tenantSlug` parameter
- Build the `redirectTo` URL as `/t/:tenantSlug/reset-password` when a slug is available

#### 2. `src/pages/Auth.jsx` — Pass effectiveSlug to resetPassword
- Change `resetPassword(form.email)` to `resetPassword(form.email, effectiveSlug)`

#### 3. `supabase/functions/auth-email-hook/index.ts` — Resolve tenant and pass to templates
- After resolving `resolvedTenantId`, also fetch the tenant's `name` and `slug` from the `tenants` table
- Build a tenant-scoped `siteUrl` (e.g., `https://app.churchmanagementsuite.org/t/:slug`) and pass it as `siteUrl` in template props
- Pass `churchName` (tenant name) to templates instead of the hardcoded `SITE_NAME`
- Use tenant name in the `from` field and email subject where appropriate

#### 4. Email templates — Accept and use `churchName` prop
Update these templates to replace hardcoded "Winners Chapel International Cardiff" with a dynamic `churchName` prop:

- **`signup.tsx`** — Preview text, heading, body text all use `churchName`
- **`recovery.tsx`** — Preview text and body text use `churchName`
- **`magic-link.tsx`** — Preview text and body text use `churchName`
- **`welcome-registration.tsx`** — Header, body, and footer use `churchName`; already receives `siteUrl`

#### 5. `supabase/functions/send-welcome-email/index.ts` — Already tenant-scoped
This function already resolves the tenant name and slug. Update the email subject from hardcoded "Welcome to Winners Chapel International Cardiff" to use the resolved tenant name. Pass `churchName` to the template.

#### 6. Deploy edge functions
Deploy `auth-email-hook` and `send-welcome-email` after changes.

### Technical Details

**auth-email-hook tenant resolution** (already exists for `tenant_id`, extend for name/slug):
```typescript
// After resolving resolvedTenantId, fetch tenant details
let tenantName = ''
let tenantSlug = ''
if (resolvedTenantId) {
  const { data: t } = await supabase.from('tenants').select('name, slug')
    .eq('id', resolvedTenantId).maybeSingle()
  if (t) { tenantName = t.name; tenantSlug = t.slug }
}
const churchName = tenantName || 'Church Connect'
const tenantSiteUrl = tenantSlug
  ? `https://${ROOT_DOMAIN}/t/${tenantSlug}`
  : `https://${ROOT_DOMAIN}`
```

**Template prop changes** — each template gets `churchName` added to its interface and replaces hardcoded text.

### Files changed
- `src/hooks/useAuth.jsx`
- `src/pages/Auth.jsx`
- `supabase/functions/auth-email-hook/index.ts`
- `supabase/functions/_shared/email-templates/signup.tsx`
- `supabase/functions/_shared/email-templates/recovery.tsx`
- `supabase/functions/_shared/email-templates/magic-link.tsx`
- `supabase/functions/_shared/email-templates/welcome-registration.tsx`
- `supabase/functions/send-welcome-email/index.ts`

