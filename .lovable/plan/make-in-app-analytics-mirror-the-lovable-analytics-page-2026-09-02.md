# Make in-app analytics mirror the Lovable analytics page

Goal: the Usage / Traffic panel inside the app should show the same picture as the Lovable project analytics page — same metric definitions, same breakdowns, and the same history.

Important constraint: Lovable's analytics is a separate system with no live API the app can query at runtime. So the app keeps its own first-party tracking, and we (a) match the metric definitions exactly, (b) add the missing breakdowns, and (c) do a one-off import of Lovable's historical daily figures so the charts start from 4 June 2026 instead of 2 September.

## What changes

1. **Metric definitions** (currently different from Lovable's):
   - Views per visit: switch to total page views / visitors (Lovable: 21,500 / 4,394 = 4.89).
   - Visit duration: average visit duration per visit, matching Lovable's "session duration" (currently one-view sessions are counted as 0s and drag it down).
   - Bounce rate: share of visits with a single page view, computed per visit rather than per stored session id.
   - Visitors and page views already match.
2. **New breakdowns to match the Lovable page**: Sources (referrer domain, "Direct" when empty) and Devices (mobile / desktop / tablet), alongside the existing Countries, Locations and Top pages.
3. **Date range**: add "Last 3 months" (and keep 7/30/90 days) so the default view can span the same window as the Lovable page.
4. **Historical import (one-off)**: load Lovable's daily totals for 4 Jun – 2 Sep 2026 into a separate `analytics_daily_totals` table — visitors, page views, views per visit, duration, bounce rate per day, plus the aggregate page / source / device / country lists. The panel reads live rows for days it has them and falls back to the imported totals for earlier days, so the chart and headline cards match the Lovable page today and stay accurate going forward.
5. **Preview traffic**: Lovable counts only the published site; the tracker currently also records the Lovable preview host. Skip beacons from preview hostnames so the two stay comparable.

## Technical notes

- Migration: new `analytics_daily_totals` table (`day` PK-ish with source label, visitors, page_views, views_per_visit, avg_duration_seconds, bounce_rate) plus `analytics_reference_lists` rows for the imported page/source/device/country breakdowns; RLS restricted to super admins, with GRANTs for `authenticated` (read) and `service_role`.
- Data load via `run_sql` using the daily figures read from the Lovable analytics API (visitors, pageviews, pageviewsPerVisit, sessionDuration, bounceRate per day; page/source/device/country totals).
- Rewrite `get_traffic_summary` and `get_traffic_series` to union live `analytics_page_views` aggregates with `analytics_daily_totals` for days before live tracking began, and to use the corrected per-visit formulas. Imported days are platform-wide only, so they are included when no church filter is applied and excluded when one is.
- New RPCs `get_traffic_sources` and `get_traffic_devices` (same role check as the existing ones); `analytics_page_views` already stores `referrer` and `device_type`.
- `TrafficPanel.jsx`: add Sources and Devices cards, add the 3-month range option, and label imported days so the numbers are traceable.
- `src/lib/analytics-tracker.js`: skip Lovable preview hostnames.

## Expected result

The in-app panel shows 4,394 visitors / 21,500 page views / 4.89 views per visit / ~6m 54s / 36% bounce for the 4 Jun – 2 Sep window, with the same top pages, sources, devices and countries — matching the Lovable analytics page — and continues from live first-party data after 2 September.
