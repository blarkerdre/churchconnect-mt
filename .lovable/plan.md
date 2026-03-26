

## Plan: Fix Backend Connection to Correct Project

### Root Cause

`vite.config.js` has **hardcoded fallback values** from the original project (`komqiadgeaapeuuzbovn`). The `define` block then force-overrides `import.meta.env` variables at build time, baking in the old project's URL and anon key even though the `.env` file has the correct values for the remixed project (`qfordhikmtgedfybktjg`).

This is why:
- You can sign in with old credentials (hitting old auth)
- Direct DB queries to this project show zero users
- Both "test" and "live" show identical data (it's all from the old project)

### Fix

**Remove the `define` block and hardcoded fallbacks from `vite.config.js`**. Vite natively handles `VITE_*` env vars from the `.env` file -- no manual override is needed.

The updated `vite.config.js` will be:

```js
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '::',
  },
})
```

This aligns with the existing memory note about avoiding manual `define` blocks.

### After the Fix

- The app will connect to `qfordhikmtgedfybktjg` (this project's backend)
- The database will be empty (fresh remix) -- no users exist yet
- You will need to create your first admin account (via signup or the admin edge function)

### Files Changed
- `vite.config.js` -- remove `define` block and old fallback values

