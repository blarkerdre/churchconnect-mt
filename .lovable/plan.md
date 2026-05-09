## What the profiler shows

On `/` (LandingPage) in the preview:

- **First Contentful Paint: 8.5s**, DOMContentLoaded: 8.4s
- **TTFB: 970ms** (network OK)
- **95 script requests, ~1MB total** — Vite dev server is serving each dependency individually
- Slowest deps: `lucide-react` (1.8s, 166KB), shadcn chunk (1.7s, 140KB), `@supabase/supabase-js` (1.3s), `react-router-dom` (1.3s)
- JS heap only 9MB, DOM 285 nodes — runtime is fine, **the bottleneck is module loading on first paint**

Routing is already lazy-loaded, so the issue is what's eagerly imported by `main.jsx` / `App.jsx` / `LandingPage.jsx` before first paint.

## Important context

The preview runs the **Vite dev server** (unbundled ES modules, no minification, cold cache). This is dramatically slower than the published build.

**Step 1 — confirm it's a real problem, not just dev preview overhead:**
Open the **published URL** (`https://app.churchmanagementsuite.org/`). If it loads in 1–2s there, no code change is needed — the dev preview is just slow by nature. If it's still slow on production, proceed with the optimizations below.

## If production is also slow — proposed optimizations

### A. Trim what loads before first paint (biggest win)

`App.jsx` eagerly imports `LandingPage`, `Auth`, `useUnitMembership`, `AuthProvider`, `TenantProvider`, `TenantThemeProvider`, `AppLayout`. The landing page only needs `LandingPage`.

- Lazy-load `Auth` and `AppLayout` (only needed after login)
- Keep `LandingPage` eager (it's the LCP for `/`)
- Audit `LandingPage.jsx` for heavy imports (icons, images, framer-motion). Replace barrel imports with named imports where possible.

### B. Reduce `lucide-react` cost

`lucide-react` is the single largest module (166KB). Vite already tree-shakes named imports in production, but if any file does `import * as Icons from "lucide-react"` it pulls everything. Audit and fix.

### C. Preload critical chunks

Add `<link rel="modulepreload">` hints in `index.html` for the React + Supabase chunks so the browser fetches them in parallel with the HTML parse.

### D. Image / font optimization on LandingPage

- Ensure hero images use `loading="eager"` + `fetchpriority="high"` and are properly sized (WebP, responsive `srcset`)
- Verify Google Fonts use `display=swap` (already in core memory) and only the weights actually used

### E. Code-split `LandingPage` sub-sections

If `LandingPage.jsx` is large, split below-the-fold sections into lazy chunks so the hero paints first.

## Out of scope

- Backend/database performance (no slow queries reported; this is a frontend cold-start issue)
- Upgrading Lovable Cloud compute (won't help frontend asset loading)

## Files I'd touch (after confirming prod is slow)

- `src/App.jsx` — lazy-load `Auth` + `AppLayout`
- `src/pages/LandingPage.jsx` — audit imports, split below-the-fold
- `index.html` — modulepreload hints
- Any file with `import * as ... from "lucide-react"` — convert to named imports

## Recommended next step

Reload the **published URL** and tell me the load time you see there. That decides whether we ship optimizations or whether the dev preview was just being a dev preview.
