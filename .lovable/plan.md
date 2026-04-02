

## Route /auth Signups to "Demo Church (TEST)" Tenant

### Problem
Currently, signups from the generic `/auth` page fall back to `DEFAULT_TENANT_ID` which points to "Winners Chapel International, Cardiff" (`95e53cc3-...`). The user wants these to land in "Demo Church (TEST)" (`d8bbbdae-d9b3-4999-912d-3aa5999884b0`, slug `demo-test`).

### Changes

#### 1. `src/contexts/TenantContext.jsx` — Update DEFAULT_TENANT_ID
Change the constant from `95e53cc3-4569-4dd3-a4ad-3489593dce81` to `d8bbbdae-d9b3-4999-912d-3aa5999884b0`.

#### 2. Database migration — Update `handle_new_user()` trigger
The trigger hardcodes the fallback tenant ID. Update it from `95e53cc3-...` to `d8bbbdae-d9b3-4999-912d-3aa5999884b0`.

#### 3. `supabase/functions/public-register/index.ts` — Update DEFAULT_TENANT_ID
Change the hardcoded fallback from `95e53cc3-...` to `d8bbbdae-d9b3-4999-912d-3aa5999884b0`.

### Files changed
- `src/contexts/TenantContext.jsx`
- `supabase/functions/public-register/index.ts`
- Database migration (update `handle_new_user()` fallback)

