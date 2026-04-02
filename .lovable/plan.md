

## Fix: auth-email-hook `resolvedTenantId` Reference Error

### Problem

The `auth-email-hook/index.ts` has a variable ordering bug:
- Line 223: `if (resolvedTenantId)` — first usage
- Line 260: `const supabase = createClient(...)` — client created
- Line 268: `let resolvedTenantId: string | null = null` — declaration

`resolvedTenantId` and the `supabase` client are used before they're declared. This causes a `ReferenceError` on every signup, preventing confirmation emails from being sent.

### Fix

Reorder the code in `supabase/functions/auth-email-hook/index.ts` so that:
1. The `supabase` client is created **immediately after** determining `emailType` (after line 218)
2. The `resolvedTenantId` resolution block (lines 268-311) is moved **before** the tenant name/slug lookup (line 220)
3. Remove the duplicate `supabase` creation on lines 260-263

The resulting order will be:
1. Determine `emailType` and `EmailTemplate`
2. Create `supabase` client
3. Resolve `resolvedTenantId` from memberships/metadata
4. Resolve `tenantName` and `tenantSlug` using `resolvedTenantId`
5. Build template props and render
6. Generate `messageId`, log, and enqueue

After fixing, redeploy the `auth-email-hook` edge function.

### Files changed
- `supabase/functions/auth-email-hook/index.ts` — reorder variable declarations and supabase client creation

