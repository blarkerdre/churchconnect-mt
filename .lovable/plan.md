## Fix: `gen_salt(unknown) does not exist`

The new Teen Self Check-in RPCs call `crypt(_pin, gen_salt('bf'))` to bcrypt-hash the self-PIN, but `gen_salt` lives in the `pgcrypto` extension, which isn't currently enabled in this database. That's why the RPC errors out.

### Change

One small migration:

1. `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;` (Supabase's standard location for extensions).
2. Recreate `teen_self_set_pin` (and any other new RPC using `gen_salt`/`crypt`) with `SET search_path = public, extensions` so the functions resolve `gen_salt` and `crypt` from `extensions`.

No frontend changes. No data changes. No other RPCs touched.

### Verification

- Run the failing self-PIN set flow again from `/teens-checkin` — the RPC should now succeed and store a bcrypt hash in `teens.self_pin_hash`.
- Subsequent `teen_self_checkin` calls verify against that hash via `crypt(_pin, self_pin_hash) = self_pin_hash`.

Shall I apply the migration?