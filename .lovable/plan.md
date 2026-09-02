# Match analytics numbers to Lovable's definitions

Keep the current in-app tracking, but calculate the five headline numbers exactly the way Lovable's project analytics does, so the two dashboards agree once data has accumulated.

## What changes

1. **Views per visit** — currently the average page views per session. Lovable computes it as total page views divided by visitors (its own figures: 534 / 147 = 3.63). Switch to that.
2. **Visit duration** — currently the average of `last view - first view` per session, including one-view sessions counted as 0 seconds, which drags the average down. Switch to the average visit duration per visitor-visit, matching Lovable's "session duration".
3. **Bounce rate** — currently the share of *sessions* with a single view. Switch to the share of *visits by visitor* with a single view, matching Lovable's bounce definition.
4. **Visitors / page views** — definitions already match (distinct visitor ids, raw view count); left as-is.
5. **Preview traffic** — Lovable only counts the published site. The tracker currently also records visits on the Lovable preview host, which inflates our numbers. Skip beacons from `*-preview--*.lovable.app` so only real published/custom-domain traffic is counted.

No new panels, no chart or layout changes.

## Technical notes

- Rewrite `public.get_traffic_summary` via a migration: derive per-visitor visit rows (visitor + session), then `page_views / visitors` for views-per-visit, `avg(duration)` over visits, and `count(visits with 1 view) / count(visits)` for bounce rate. Rounding stays at 2 dp / whole seconds / whole percent.
- `get_traffic_series`, `get_traffic_locations`, `get_traffic_top_pages`, `get_traffic_by_tenant` are unchanged.
- `src/lib/analytics-tracker.js`: extend the existing host guard to also skip Lovable preview hostnames.

## Expected result

Definitions will line up, but the totals will still differ from Lovable's historical chart because our table only started collecting on 2 Sep — earlier days cannot be backfilled with per-visit detail.
