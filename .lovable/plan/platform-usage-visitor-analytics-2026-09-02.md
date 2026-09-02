# Platform Usage & Visitor Analytics

Add first-party visitor analytics — visitors, page views, views per visit, visit duration, bounce rate, plus country/city location — covering both public pages and signed-in app usage.

## What you get

A new analytics view with:
- Headline cards: Visitors, Page views, Views per visit, Visit duration, Bounce rate
- Daily visitors trend chart with hover tooltip (matching the reference layout)
- Range selector: Last 7 / 30 / 90 days
- Top locations table (country + city) with visitor counts, and a country breakdown bar
- Top pages table, and (super admin only) a per-church usage table

Where it appears:
- Super Admin: Tenant Admin -> Analytics gets a "Traffic & Locations" section covering all traffic platform-wide, with an optional church filter.
- Church admins/owners: a "Usage" section on the existing Analytics page, scoped to their own church only.

## How tracking works

Every page view in the app (public landing, public registration/check-in links, and signed-in pages) sends a small beacon. A visit is a session: page views from the same anonymous visitor within 30 minutes of each other. Visit duration is the time between first and last view in a visit; a visit with a single page view counts as a bounce.

Privacy: no IP address is ever stored. The country and city are resolved at collection time and only those labels are kept. Visitors are identified by a rotating anonymous ID (no cookies tied to identity), so no personal data lands in the analytics tables. This keeps it consistent with the existing UK/GDPR posture, and the tracker respects Do Not Track.

## Technical outline

Database (migration):
- `analytics_page_views`: `id`, `tenant_id` (nullable for pre-tenant public traffic), `visitor_id` (hashed), `session_id`, `path`, `referrer`, `country`, `city`, `device_type`, `is_authenticated`, `created_at`. Indexes on `(created_at)`, `(tenant_id, created_at)`, `(session_id)`.
- GRANTs: `service_role` full; `authenticated` SELECT (RLS-restricted); no `anon` access — inserts happen only through the edge function.
- RLS: super admins read all (`is_super_admin`); tenant admins/owners read rows where `tenant_id` matches a tenant they administer. No client insert policy.
- Aggregation RPCs (SECURITY DEFINER, role-checked): `get_traffic_summary(_tenant_id, _from, _to)`, `get_traffic_series(...)`, `get_traffic_locations(...)`, `get_traffic_top_pages(...)`, and `get_traffic_by_tenant(...)` for the super-admin table. Doing the roll-ups in SQL keeps the client light.
- 12-month retention: existing retention policy machinery gets an entry for this table.

Edge function `track-pageview` (`verify_jwt = false`, no auth required):
- Zod-validated body: `path`, `referrer`, `session_id`, `visitor_id`, `tenant_slug?`.
- Derives country/city from the request geo headers (with an IP-geo lookup fallback), resolves `tenant_id` from slug, inserts one row with the service role. IP is used transiently and never written.
- Basic per-visitor rate limiting via the existing `public_endpoint_rate_limits` table to stop beacon flooding.

Frontend:
- `src/lib/analytics-tracker.js`: generates/stores `visitor_id` (rolling, localStorage) and `session_id` (sessionStorage, 30-min idle expiry), and posts the beacon.
- A route-change listener mounted once in the app shell fires on every navigation, including public routes.
- `src/components/analytics/TrafficPanel.jsx`: shared presentational panel (cards + Recharts area chart + locations/pages tables), reused by both the Tenant Admin tab and the tenant Analytics page, with the tenant filter enabled only for super admins.

Note: historical traffic cannot be backfilled — the charts start filling from the moment tracking goes live.
