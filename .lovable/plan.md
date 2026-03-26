

## Analysis: Why Live and Test Show Identical Data

### What I Found

I queried both database environments directly:

| | Production (Live DB) | Development (Test DB) |
|---|---|---|
| Tenant name | **LFC Cardiff** | **Demo Church (TEST)** |
| Tenant slug | `lfc-cardiff` | `demo-test` |
| Tenant ID | `a0000000-...0001` | `a0000000-...0001` |
| Your user ID | `932364f2-...` | `33c7eafc-...` |

The databases ARE different. **LFC Cardiff exists only in Live. Demo Church (TEST) exists only in Test.** The data is correct at the database level.

### Root Cause

Both the preview app and the published app connect to the **same Supabase instance** via `VITE_SUPABASE_URL`. This single URL points to one database -- so regardless of whether you open the preview or the published site, the app queries the same data.

The environment indicator (Test/Live badge) works based on **hostname detection only** -- it does not change which database the app talks to. Both environments see whichever database `VITE_SUPABASE_URL` resolves to.

This is a fundamental constraint: the app has one database connection string baked in at build time.

### What Needs to Happen

There is no code fix that can make the preview and published app show different data -- they share one database. The correct approach is:

1. **Accept single-database reality** -- both preview and published connect to the same backend. This is how Lovable Cloud works for the running app.

2. **Remove the misleading environment indicator** -- or change it to only show hostname info without implying separate data. The "Test" vs "Live" badge currently gives a false impression of data isolation.

3. **Use LFC Cardiff as the real tenant** -- since both environments share one database, ensure your production tenant (LFC Cardiff) is present. Right now, one database has it and the other has "Demo Church (TEST)." Whichever database the app connects to determines what you see.

4. **Ensure LFC Cardiff exists in the connected database** -- I can check which database the app actually connects to, then ensure it has the correct tenant data (LFC Cardiff for your real use, plus optionally keeping Demo Church for testing purposes).

### Proposed Plan

**Step 1:** Determine which database the app is connected to by checking the `VITE_SUPABASE_URL` value

**Step 2:** Ensure LFC Cardiff tenant exists in that database alongside Demo Church (TEST) -- both can coexist since they would have different IDs

**Step 3:** Update the environment indicator to show the actual connected backend info instead of misleading "Test"/"Live" labels, or remove it entirely

**Step 4:** Set up your user's membership and role for LFC Cardiff in whichever database the app is using

### Files to Change
- `src/lib/environment.js` -- update or remove misleading environment labels
- `src/pages/TenantAdmin.jsx` -- remove environment badge or make it accurate
- Database inserts to ensure LFC Cardiff exists in the active database

