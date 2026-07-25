## Full responsive sweep — every tenant × every route

### Phase 1 — Enumerate tenants
Query `tenants` (non-archived) to get the full list of `{id, slug, name}`. Sweep uses the injected super-admin session, which has cross-tenant access, and drives navigation via the `/t/:tenantSlug/...` path — no per-tenant password required.

### Phase 2 — Capture
For each tenant slug, screenshot every route at 384×800, 768×1024, 1280×900. Save under `/tmp/browser/responsive/<tenant-slug>/<route>/<viewport>.png`.

Route set (same as prior sweep):
- Dashboard, Members, Communications, Events, Pastoral Care, Transportation
- Attendance, Church Attendance, Teens Attendance, Children Church
- Home Cell, Bible School, Follow-ups, Unit Tasks
- Inventory, Sermon Notes, Testimony, Analytics, Reports
- My Profile, My Family, My Data, Settings, User Management
- Tenant Admin, Audit Log, System Logs

Public routes captured once (tenant-agnostic): `/`, `/auth`, teens check-in landing, public registration.

Automated overflow detector per screenshot: flag when `document.documentElement.scrollWidth > innerWidth` and log the offending element's selector + width.

### Phase 3 — Diff for tenant-specific issues
Group findings into:
- **Global** (same overflow on every tenant) → fix once in the shared component
- **Tenant-specific** (only fires on tenants with long names, custom logos, dense unit lists, custom nav links, or dynamic theming) → fix the responsible component to tolerate the widest real data

Likely tenant-specific offenders based on codebase memory:
- Long tenant name in header (`AppLayout`, `TenantDialogHeader`)
- Custom favicon/OG branding surfaces
- External nav links (variable count) in sidebar
- Church units / WSF centres tables (variable row count and label length)

### Phase 4 — Fix by category
Frontend/presentation only:
- Horizontal overflow → `min-w-0`, `flex-wrap`, `overflow-x-auto`, `truncate`, `shrink-0`
- Long tenant/unit names → `truncate` + `title` attribute, no fixed-width parents
- Dialog > viewport height → `max-h-[90vh] overflow-y-auto` + sticky header/footer
- Wide tables → mobile scroll container or stacked-card fallback
- Tab bars → `overflow-x-auto whitespace-nowrap`
- Bottom-nav collision → `pb-20 lg:pb-6` on page shells missing it
- Any hardcoded color surfaced (`text-white`, `bg-black`, hex) → semantic tokens

No schema, RLS, business logic, or redesign changes.

### Phase 5 — Verify
Re-screenshot every previously-broken tenant × route × viewport combination. Deliver:
- Per-tenant summary (clean vs. residual issues)
- Files changed grouped by fix category
- Before/after screenshots for top offenders
- Residual issues flagged for product decisions

### Technical notes
- Auth: reuse `LOVABLE_BROWSER_SUPABASE_*` env vars once; super-admin session grants tenant access via URL slug — no logout/login loop.
- Concurrency: run tenants sequentially inside one Playwright process to keep the session hot; parallelise viewports per route with `page.setViewportSize`.
- Cost control: sweep is O(tenants × routes × 3). If tenant count is large (>10), I'll show you the count after Phase 1 and confirm before running Phase 2 in full.
