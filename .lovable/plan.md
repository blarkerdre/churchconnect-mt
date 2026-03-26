

## Root Cause Found: Missing Environment Variables in Published Build

### The Error

The live site at `app.churchmanagementsuite.org` crashes immediately with:

```
Error: supabaseUrl is required.
```

This means `VITE_SUPABASE_URL` is **undefined** in the published build. The Supabase client (`src/integrations/supabase/client.ts`) calls `createClient(undefined, undefined)` which throws before React even mounts -- hence the blank white screen.

### Why Preview Works But Published Doesn't

- **Preview**: Vite dev server injects `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the auto-managed `.env` file at runtime
- **Published**: These values are baked into the JS bundle at build time. If the build ran without the env vars present, the published bundle has `undefined` for both values

### This Is Not a Code Bug

The `.env` file and `client.ts` are auto-generated and cannot be edited. The env vars exist in the dev environment (preview works). The published build simply doesn't have them baked in.

### Fix

**Re-publish the project** -- click Publish, then Update. This will trigger a fresh build that should pick up the current `.env` values and bake them into the production bundle.

If re-publishing still produces a blank screen with the same error, this is a platform-level issue with env var injection during the publish build process, and would need to be escalated.

### No code changes needed

