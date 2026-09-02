# Fix: visitor analytics shows no data

## What I found

Tracking beacons are firing from the app, but no page view is ever recorded.

- `analytics_page_views` has 0 rows (no rows ever, latest timestamp is empty).
- The backend function logs for `track-pageview` in the last 2 hours contain **only** `OPTIONS` browser preflight requests — not a single `POST`. So the browser asks permission, and then never sends the actual beacon.
- The only rate-limit row is from a manual smoke test, confirming real traffic never reached the insert.

Cause: the beacon is sent as an `application/json` blob via `navigator.sendBeacon`. That content type forces a CORS preflight, and the function's preflight response does not satisfy the browser (its CORS headers come from a shared import rather than an explicit allow-list of methods/headers), so the browser drops the POST silently.

## The fix

1. **Send a preflight-free beacon.** Post the payload as a `text/plain` blob, which is a "simple" request the browser sends immediately with no preflight. The function already parses the body as JSON, so the payload is unchanged.
2. **Make the function's CORS explicit.** Define the headers inline in `track-pageview`: allow origin `*`, methods `POST, OPTIONS`, and headers `authorization, x-client-info, apikey, content-type`. Return `204` for `OPTIONS`. This keeps the `fetch` fallback path working too.
3. **Add the anon key to the fetch fallback** so requests that go through `fetch` are accepted by the functions gateway.
4. **Verify end to end**: after deploying, load a couple of pages, then confirm rows appear in `analytics_page_views` and the Traffic panel cards/chart populate.

Note: nothing can be backfilled — the charts will start filling from the moment the fix is live. The panel will still look empty for a few minutes until real navigation happens.

## Technical detail

- `src/lib/analytics-tracker.js`: blob type `text/plain;charset=UTF-8`; fetch fallback gains `apikey` + `Authorization: Bearer <publishable key>` headers.
- `supabase/functions/track-pageview/index.ts`: replace the `npm:@supabase/supabase-js@2/cors` import with a local `corsHeaders` constant, `OPTIONS` → `204`.
- No database or RLS changes; the insert path and RPCs are already correct.
