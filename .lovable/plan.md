

## Fix: Missing `.env` File Causing Blank Screen

### Root Cause

The `.env` file is **completely missing** from the project. The browser console confirms:

```
Error: supabaseUrl is required.
```

The Supabase client at `src/integrations/supabase/client.ts` reads `VITE_SUPABASE_URL` from `import.meta.env`, which is `undefined` because there's no `.env` file to provide it. This crashes the app before React mounts — both in preview and published builds.

### Why This Happened

The `.env` file is supposed to be auto-generated and maintained by the Lovable Cloud integration. It appears to have been deleted or lost.

### Fix

**Recreate the `.env` file** with the known Supabase project values:

```
VITE_SUPABASE_PROJECT_ID="qfordhikmtgedfybktjg"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3JkaGlrbXRnZWRmeWJrdGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTY3ODcsImV4cCI6MjA5MDAzMjc4N30.edOKxghMZxEq9VK3VVKAa_-WTQPZkOyVT7-pJFr31ho"
VITE_SUPABASE_URL="https://qfordhikmtgedfybktjg.supabase.co"
```

### What This Fixes

- Preview will render again immediately
- Published builds will include the correct env vars when re-published

### Files Changed

- **`.env`** — recreate with the three required Supabase environment variables

