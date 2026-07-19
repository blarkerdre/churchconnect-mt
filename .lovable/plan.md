## Diagnosis
`teen_checkin` (and `teen_self_checkin`, `teen_self_set_pin`) call bare `crypt(...)` while their `search_path` is set to `'public'` only. `pgcrypto` lives in the `extensions` schema, so Postgres can't resolve the function → `function crypt(text, text) does not exist`.

`crypt_pin` already works because it qualifies as `extensions.crypt(...)`.

## Fix
Single migration that recreates the three affected functions with `extensions.crypt(...)` qualified references, leaving all other logic identical. Options considered:
- Qualifying the call (chosen) — smallest, most explicit change.
- Adding `extensions` to each function's `search_path` — also works but hides the dependency.

Migration recreates:
- `public.teen_checkin(_qr_token uuid, _teen_id uuid, _pin text)` — replace `crypt(_pin, v_teen.access_pin_hash)` with `extensions.crypt(_pin, v_teen.access_pin_hash)`.
- `public.teen_self_checkin(...)` — same substitution.
- `public.teen_self_set_pin(...)` — same substitution.

No RLS, table, or grant changes. No frontend changes.
