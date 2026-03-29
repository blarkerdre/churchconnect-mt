

## Update: Make First Timer / New Convert Questions Tenant-Specific

### Change

Instead of hardcoding "Winners Chapel International, Cardiff" in the welcome questions, dynamically use the current tenant's name from context.

**Affected questions:**
- "Have you worshipped with us at **{tenantName}**?"
- "Would you like to join **{tenantName}**?"
- "Do you live or work in this city or its environ?"
- All other first-timer questions remain generic (no church name needed)

### How

In each form file, access the tenant name:
- **`src/pages/PublicRegistration.jsx`** — already has tenant data from the slug-based fetch; use `tenantName` from that state
- **`src/components/members/MemberFormDialog.jsx`** — use `useTenant()` → `currentTenant?.name`
- **`src/pages/MyProfile.jsx`** — use `useTenant()` → `currentTenant?.name`

For the `public-register` edge function, the tenant name isn't needed server-side (these are just UI labels).

### Implementation note

This is part of the previously approved but not-yet-implemented first-timer/new-convert fields feature. The full implementation includes:
1. **Database migration** — add 9 new columns to `members` table
2. **3 form files** — add conditional welcome questions section with tenant-scoped labels
3. **Edge function** — accept and persist the new fields

The tenant-scoping of question labels will be built into step 2 naturally.

### Files to change
1. **1 database migration** — add 9 nullable columns to `members`
2. **`src/pages/PublicRegistration.jsx`** — add welcome questions with `tenantName` interpolation
3. **`src/components/members/MemberFormDialog.jsx`** — same, using `currentTenant?.name`
4. **`src/pages/MyProfile.jsx`** — same, using `currentTenant?.name`
5. **`supabase/functions/public-register/index.ts`** — sanitize and persist new fields

