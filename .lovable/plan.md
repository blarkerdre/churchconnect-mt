

## Problem

The `define` block in `vite.config.js` (lines 23-26) hardcodes `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at build time using `loadEnv` with fallback values. This overrides the auto-generated `.env` file that Lovable Cloud provides, which contains the correct environment-specific backend URLs for Test vs Live. Both builds end up pointing to the same backend instance.

## Fix

Remove the `define` block and the manual env loading logic from `vite.config.js`. The `.env` file is auto-managed by the platform and already provides the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values per environment. Vite natively reads these without any custom `define` overrides.

### Updated `vite.config.js`

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

## After the fix

You will need to **publish** the updated build so the Live site picks up the correct backend URL from its own environment.

**One file changed:** `vite.config.js`

