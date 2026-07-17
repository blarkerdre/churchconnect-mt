## Root cause

The QR check-in page opens for anyone who scans (including parents before they sign in). It looks up the session with a direct table query:

```js
supabase.from("teen_attendance_sessions").select(...).eq("qr_token", token)
```

But `teen_attendance_sessions` RLS only allows `SELECT` to authenticated users who pass `user_has_tenant_access(tenant_id)`. Confirmed via `pg_policy`:

- `teen_sessions_read` → role `authenticated`, `USING (user_has_tenant_access(tenant_id))`

So when an unauthenticated scanner (or a signed-in user who isn't a tenant member yet) opens the link, RLS filters the row out, `maybeSingle()` returns `null`, and the page shows **"This check-in link is invalid."**

The same bug exists in the Bible School flow structurally, but that page requires sign-in first via `wofbi_checkin` RPC (SECURITY DEFINER), so it doesn't hit RLS on the session table directly. The teens page reads the session *before* auth, which is where it breaks.

## Fix

Add a `SECURITY DEFINER` RPC that returns minimal, non-sensitive session info by `qr_token`, and switch the client to use it. Keeps RLS on the base table strict.

1. **Migration** — create RPC `public.get_teen_session_by_token(_qr_token uuid)` that returns `id, title, session_date, status, tenant_id` for the matching row. `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE TO anon, authenticated`.

2. **`src/pages/TeensCheckin.jsx`** — replace the direct `teen_attendance_sessions` select with `supabase.rpc("get_teen_session_by_token", { _qr_token: token })`. Keep the same downstream logic (open/closed handling, teens load, magic-link, PIN flow). No UI changes.

No changes to `teen_checkin` RPC — it already validates the token server-side.

## Verification

- Open the QR link while signed out → page shows session title/date and the magic-link/PIN options (not "invalid link").
- Closed session → still shows "This session is closed."
- Made-up token → still shows "invalid link".
- Signed-in guardian flow (tap teen → check in) continues to work.
