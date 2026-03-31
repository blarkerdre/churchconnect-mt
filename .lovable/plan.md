

## Fix: New Registration Directed to Demo Church

### Root cause

Three frontend/edge-function files and the `handle_new_user` database trigger still use the old Demo Church ID (`d8bbbdae-d9b3-4999-912d-3aa5999884b0`) as the default tenant fallback instead of WCI Cardiff (`95e53cc3-4569-4dd3-a4ad-3489593dce81`).

When a user registers without an explicit tenant slug, they get assigned to Demo Church instead of WCI Cardiff.

### Stale references

| File | Line | Current value |
|------|------|--------------|
| `src/pages/PublicRegistration.jsx` | 5 | `d8bbbdae-...` (Demo Church) |
| `src/pages/PublicWoFBIRegistration.jsx` | 14 | `d8bbbdae-...` (Demo Church) |
| `supabase/functions/public-wofbi-register/index.ts` | 8 | `d8bbbdae-...` (Demo Church) |
| `handle_new_user()` trigger | fallback line | `d8bbbdae-...` (Demo Church) |

The correct ID (`95e53cc3-4569-4dd3-a4ad-3489593dce81`) is already used in `TenantContext.jsx` and `public-register/index.ts`.

### Fix

**1. `src/pages/PublicRegistration.jsx`** — Update `DEFAULT_TENANT_ID` to `95e53cc3-4569-4dd3-a4ad-3489593dce81`

**2. `src/pages/PublicWoFBIRegistration.jsx`** — Same update

**3. `supabase/functions/public-wofbi-register/index.ts`** — Same update

**4. Database migration** — Update the `handle_new_user()` trigger fallback from `d8bbbdae-...` to `95e53cc3-...`

### Files changed
- `src/pages/PublicRegistration.jsx` — fix DEFAULT_TENANT_ID
- `src/pages/PublicWoFBIRegistration.jsx` — fix DEFAULT_TENANT_ID
- `supabase/functions/public-wofbi-register/index.ts` — fix DEFAULT_TENANT_ID
- 1 new migration — update `handle_new_user` fallback tenant ID

