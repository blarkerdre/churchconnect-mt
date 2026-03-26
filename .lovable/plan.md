

## Plan: Fix Live Environment -- Hardcode Env Fallbacks in Vite Config

### Problem

The published build on `app.churchmanagementsuite.org` crashes immediately with:
```
Error: supabaseUrl is required.
```

The `.env` file keeps getting lost between sessions, and when a publish build runs without it, the `VITE_SUPABASE_*` values are `undefined` in the compiled bundle. The Supabase client then crashes before React mounts.

### Solution

Add `define` fallbacks in `vite.config.js` so that if the env vars are missing at build time, the known values are still inlined. These are all **publishable** values (anon key, project URL) so they are safe to store in the codebase.

### File: `vite.config.js`

Add an `envDefaults` object and spread it into the Vite `define` config. This ensures the values are always available even if `.env` is absent:

```js
const envDefaults = {
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://qfordhikmtgedfybktjg.supabase.co'),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmb3JkaGlrbXRnZWRmeWJrdGpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTY3ODcsImV4cCI6MjA5MDAzMjc4N30.edOKxghMZxEq9VK3VVKAa_-WTQPZkOyVT7-pJFr31ho'),
  'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify('qfordhikmtgedfybktjg'),
};
```

These only apply as fallbacks -- if `.env` provides the values, Vite's built-in env handling takes precedence.

### After Implementation

Re-publish the project. The new build will have the Supabase credentials compiled in regardless of `.env` state.

### Files Changed

- **`vite.config.js`** -- add `define` block with fallback env values

