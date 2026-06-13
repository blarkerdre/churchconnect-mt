## Problem

When a worker enters the 6-digit PIN, picks the authorised adult, and clicks Release, the request fails silently in the UI but the database logs show:

```
ERROR: function digest(text, unknown) does not exist
```

The `release_child` RPC calls `encode(digest(_pin || '|' || _checkin_id::text, 'sha256'), 'hex')`. `digest` lives in the `extensions` schema (pgcrypto), and the second argument needs an explicit `::text` cast. The same bug was already fixed for `checkin_child` in the previous migration — `release_child` (and the delegation-code branch) was missed.

## Fix

Single migration that recreates `public.release_child` with:

1. `SET search_path TO 'public', 'extensions'` (matches `checkin_child`).
2. Both `digest(...)` calls qualified as `extensions.digest(...)` with `'sha256'::text`:
   - PIN branch: `extensions.digest(_pin || '|' || _checkin_id::text, 'sha256'::text)`
   - Delegation-code branch: `extensions.digest(upper(_delegation_code) || '|' || _row.child_id::text, 'sha256'::text)`
3. No signature / behaviour / permission changes — pure bug fix.

## Out of scope

- UI changes — current Release button, PIN input, and adult selector are correct.
- Hashing algorithm, PIN length, delegation-code format.
- Toast surfacing of RPC errors (already wired via `onError`).
