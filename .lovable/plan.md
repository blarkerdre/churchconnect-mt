

## Fix Linter Warnings: Mutable Function Search Paths

### What changes

Add `SET search_path = public` to the 4 email queue functions that are missing it:

1. `delete_email(text, bigint)`
2. `enqueue_email(text, jsonb)`
3. `move_to_dlq(text, text, bigint, jsonb)`
4. `read_email_batch(text, integer, integer)`

These functions reference `pgmq.*` internally, so the search path needs to include both `public` and `pgmq` (or use fully qualified calls). Since they already use `pgmq.delete(...)`, `pgmq.send(...)`, etc. with explicit schema prefixes, setting `search_path = public` is safe.

### What cannot be fixed via migration

- **Extension in public schema** — `pg_net` is not relocatable; this warning is expected and harmless.
- **Leaked password protection** — must be enabled manually in the authentication settings (Cloud → Backend).

### Files changed

- **One database migration** — `ALTER FUNCTION ... SET search_path = public` for all 4 functions

