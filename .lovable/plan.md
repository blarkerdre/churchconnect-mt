## Fix: `crypt(text, text) does not exist` during teen self check-in

### Root cause (verified)
`public.teen_self_checkin` calls `crypt(_pin, v_teen.self_pin_hash)` unqualified, but its `SET search_path` is only `'public'`. `pgcrypto` lives in the `extensions` schema, so the call cannot resolve `crypt`. The sibling functions `crypt_pin` and `teen_self_set_pin` already use `search_path = public, extensions` plus `extensions.crypt(...)` — this one was missed.

### Change
One migration that recreates `public.teen_self_checkin` with:
- `SET search_path = public, extensions`
- The PIN comparison changed to `v_teen.self_pin_hash <> extensions.crypt(_pin, v_teen.self_pin_hash)`

All other logic (session/consent/status/notification inserts) stays identical.

### Verification
After the migration runs, retry a teen self check-in from `TeensCheckin`; the RPC should return `ok:true` (or a domain error like `bad_pin`) instead of the `crypt` does-not-exist error.
