## Goal
Make the app load and navigate faster across the board (medium-size tenant, 50–500 members).

## Diagnosis

Two issues compound to make "everything" feel slow:

1. **The initial JS bundle loads every page up-front.** `src/App.jsx` statically imports all 30+ page components (Dashboard, Members, Events, Communications, Analytics, ExamManagement, TenantAdmin, etc.) plus their heavy children (charts, TipTap editor, QR codes, sermon editor). The browser has to download and parse all of it before the auth screen or dashboard can render. On medium connections this is the main cause of "spins forever after login".

2. **React Query has no caching window.** `src/lib/query-client.js` sets only `refetchOnWindowFocus: false` and `retry: 1`. Default `staleTime` is `0`, so every page mount re-fires the same Supabase queries (Dashboard alone runs 6 in parallel) even when you just navigated away and back a few seconds ago. With ~500 members and several admin queries per page, this hammers the backend on every click.

Backend itself reports healthy, so we fix the client first. If it's still slow under real load after that, the next step is upgrading the Lovable Cloud instance size.

## Plan

### 1. Lazy-load all authenticated pages (`src/App.jsx`)
- Convert page imports (Dashboard, Members, Events, Attendance, Followups, PastoralCare, Communications, Transportation, Analytics, WSFManagement, UserManagement, SystemLogs, TrainingReports, ExamManagement, ChurchAttendance, Settings, MyProfile, TenantAdmin, SermonNotes, Testimony, Presentation, Onboard, Unsubscribe, PublicRegistration, PublicWoFBIRegistration, ResetPassword) to `React.lazy(() => import(...))`.
- Keep `Auth`, `LandingPage`, `AppLayout`, providers, and `main.jsx` as static imports (per existing Bootstrap Stability rule — only main.jsx is sensitive; route-level lazy is safe and standard).
- Wrap the `<Routes>` trees in a single `<Suspense fallback={<LoadingScreen />}>` showing the existing pulse "Loading…" UI so route transitions feel instant.

### 2. Add sensible caching defaults (`src/lib/query-client.js`)
- Set `staleTime: 60_000` (1 min) and `gcTime: 5 * 60_000` so navigating between pages reuses cached data instead of refetching.
- Keep `refetchOnWindowFocus: false` and `retry: 1`.
- This is safe because the app already calls `queryClient.invalidateQueries(...)` after mutations.

### 3. Prefetch the Dashboard chunk on the Auth page
- In `src/pages/Auth.jsx`, trigger `import("@/pages/Dashboard")` on mount (fire-and-forget) so the Dashboard chunk is downloading while the user types credentials. Login → dashboard render then feels instant.

### 4. Quick win on the Dashboard query (`src/pages/Dashboard.jsx`)
- The "members" query selects every member row just to compute counts. Replace the in-memory aggregation with a single Supabase RPC `get_dashboard_stats(_tenant_id)` returning `{ total, first_timers, new_this_month, water_baptism, hs_baptism, bfc_completed, winners_satellite }`. One small payload instead of pulling 500 rows on every dashboard mount.
- Add a matching SQL migration creating the function (security definer, search_path public, scoped by `_tenant_id`).

### Out of scope
- Upgrading Lovable Cloud instance size (separate action in Backend → Advanced settings; recommend after the above if load is still high).
- Refactoring per-page queries beyond the Dashboard (can be a follow-up if specific pages are still slow).
- Changing RLS or auth flows.

## Files touched
- `src/App.jsx` — lazy imports + `<Suspense>`
- `src/lib/query-client.js` — staleTime / gcTime
- `src/pages/Auth.jsx` — prefetch Dashboard chunk
- `src/pages/Dashboard.jsx` — switch to `get_dashboard_stats` RPC
- New migration — `get_dashboard_stats` SQL function

## Expected impact
- Initial JS download drops dramatically (only Auth + Landing on first paint).
- Navigation between already-visited pages becomes near-instant (cache hit).
- Dashboard loads with one small RPC call instead of 6 queries pulling hundreds of rows.
