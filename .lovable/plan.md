

## Fix: Move `pg_net` Extension Out of Public Schema

### Problem

The `pg_net` extension is installed in the `public` schema. This is a security concern because any user with access to the `public` schema can call `pg_net` functions (like `http_post`), potentially making arbitrary outbound HTTP requests.

### Fix

Move the extension to the `extensions` schema (Supabase's standard location for extensions):

```sql
ALTER EXTENSION pg_net SET SCHEMA extensions;
```

### Impact

- The `auto_create_followup` function references `extensions.http_post(...)` -- it already uses the `extensions` prefix, so it will continue working correctly after the move.
- No other application code references `pg_net` directly.

### Files Changed

- One database migration

