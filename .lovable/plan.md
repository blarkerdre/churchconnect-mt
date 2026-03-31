

## Fix: Replace `extensions.http_post` with `net.http_post`

### Problem
All database triggers that call edge functions use `extensions.http_post(...)`, which does not exist. The correct function is `net.http_post(...)` from the `pg_net` extension (already available on the platform).

### Important difference
`net.http_post` has a different signature — it takes `jsonb` for headers and body directly, not text:
```sql
net.http_post(
  url := '...',
  headers := '{"Content-Type":"application/json","Authorization":"Bearer ..."}'::jsonb,
  body := '{"key":"value"}'::jsonb
)
```

### Fix — 1 database migration
Replace `extensions.http_post` with `net.http_post` in all 6 affected trigger functions:

1. **`auto_create_followup`** — follow-up assignment notifications
2. **`notify_pastoral_care_new_request`** — pastoral care assignment notifications
3. **`notify_unit_leaders_on_unit_change`** — unit leader notifications
4. **`notify_wsf_leader_on_centre_selection`** — WSF leader notifications
5. **`notify_transport_assignment`** — transport booking notifications

Each function's `PERFORM extensions.http_post(...)` call gets replaced with `SELECT net.http_post(...)` using the correct parameter format (body as `jsonb` instead of `text`).

### Technical detail
```text
Before:
  PERFORM extensions.http_post(
    url := _url,
    body := jsonb_build_object(...)::text,
    headers := jsonb_build_object(...)::jsonb
  );

After:
  PERFORM net.http_post(
    url := _url,
    body := jsonb_build_object(...),
    headers := jsonb_build_object(...)
  );
```

Key changes per call:
- `extensions.http_post` → `net.http_post`
- Remove `::text` cast on body (net.http_post expects jsonb)

### Files changed
- 1 migration — `CREATE OR REPLACE FUNCTION` for all 5 trigger functions

