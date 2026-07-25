## Cross-tenant responsive & display audit

### Phase 1 — Enumerate tenants
Query non-archived `tenants` to get `{id, slug, name}`. Reuse injected super-admin session (cross-tenant via `/t/:tenantSlug/...`).

### Phase 2 — Capture
For each tenant × route × viewport (384×800, 768×1024, 1280×900), screenshot to `/tmp/browser/responsive/<tenant>/<route>/<viewport>.png`.

Routes (authenticated):
Dashboard, Members, Communications, Events, Pastoral Care, Transportation, Attendance, Church Attendance, Teens Attendance, Children Church, Home Cell, Bible School, Follow-ups, Unit Tasks, Inventory, Sermon Notes, Testimony, Analytics, Reports, My Profile, My Family, My Data, Settings, User Management, Tenant Admin, Audit Log, System Logs.

Public (once): `/`, `/auth`, teens check-in landing, public registration, WOFBI public registration.

Per screenshot: run overflow probe (`documentElement.scrollWidth > innerWidth`) and log offending selector + width. Also detect:
- clipped text (elements whose `scrollWidth > clientWidth` without `overflow` handling)
- dialogs taller than viewport without scroll container
- bottom-nav collision (content under fixed nav on mobile)
- hardcoded colors (`text-white`, `bg-black`, `bg-[#...]`) via source grep

### Phase 3 — Classify findings
- **Global** (same issue every tenant) → fix shared component
- **Tenant-specific** (long names, custom logos, dense units, custom nav, dynamic theming) → harden responsible component to widest real data

### Phase 4 — Fix (frontend/presentation only)
- Overflow → `min-w-0`, `flex-wrap`, `overflow-x-auto`, `truncate`, `shrink-0`
- Long labels → `truncate` + `title`
- Tall dialogs → `max-h-[90vh] overflow-y-auto` + sticky header/footer
- Wide tables → mobile scroll container or stacked-card fallback
- Tab bars → `overflow-x-auto whitespace-nowrap`
- Bottom-nav collision → `pb-20 lg:pb-6`
- Hardcoded colors → semantic tokens

No schema, RLS, or business-logic changes.

### Phase 5 — Verify
Re-screenshot every previously-flagged combo. Deliver:
- Per-tenant summary (clean vs. residual)
- Files changed grouped by fix category
- Before/after screenshots for top offenders
- Residual issues flagged for product decisions

### Technical notes
- Auth: reuse `LOVABLE_BROWSER_SUPABASE_*` once.
- Concurrency: tenants sequential in one Playwright process; viewports per route via `setViewportSize`.
- Cost: O(tenants × routes × 3). If tenants >6 I'll report the count after Phase 1 before running full Phase 2.
