
Root cause identified: the preview is blank because the app crashes before React renders. Browser console shows a startup error from the backend client: required backend URL env var is missing (`supabaseUrl is required`), so the app never mounts and you see a gray/white screen.

Plan to fix:

1) Restore backend env injection in preview runtime
- Re-sync the project’s backend integration so frontend runtime vars are injected again.
- Confirm required runtime vars exist at build time (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- Trigger a fresh preview rebuild after re-sync.

2) Add a startup guard so this never fails silently again
- Update `src/main.jsx` bootstrap flow to:
  - Check required backend env vars before loading the app.
  - If missing, render a clear “Configuration missing” screen (instead of blank).
  - Dynamically import `App` only when env is valid.
- This avoids full-app crash on missing config and gives actionable feedback immediately.

3) Route hardening for `/index`
- Add explicit normalization so `/index` redirects to `/` early.
- Prevents confusion when opening preview on `/index` and ensures a consistent entry route.

4) Validate end-to-end
- Preview checks:
  - Open `/` and `/index` (mobile viewport included).
  - Confirm no startup crash in console.
  - Sign in and verify dashboard renders.
- Published checks:
  - Publish update.
  - Open live URL and confirm auth + dashboard flow works.

Technical details
- Crash currently occurs during module evaluation of `src/integrations/supabase/client.ts` before React render.
- Because that file is auto-generated and should not be edited, fix is done via environment/runtime configuration plus app bootstrap guard in `main.jsx`.
- This approach is low-risk, keeps backend client generation intact, and adds user-visible diagnostics for future config drift.
