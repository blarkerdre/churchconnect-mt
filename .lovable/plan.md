

## Plan: Fix hardcoded fallback backend URL in vite.config.js

### Problem
`vite.config.js` has hardcoded fallback values pointing to an old Supabase project (`aipjlpuintvfcjnzaqlu`). When environment variables aren't loaded, the app connects to the wrong backend.

### Fix
Update `vite.config.js` line 7-12: replace the old project ID and anon key fallbacks with the current project's values (`komqiadgeaapeuuzbovn`).

**File:** `vite.config.js`
- Change fallback `projectId` from `aipjlpuintvfcjnzaqlu` to `komqiadgeaapeuuzbovn`
- Change fallback `publishableKey` to the current project's anon key

Single file, 2 lines changed.

