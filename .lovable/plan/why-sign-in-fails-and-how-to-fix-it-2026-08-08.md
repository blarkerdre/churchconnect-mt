# Why sign-in fails, and how to fix it

## What's actually happening

Your password is fine. The network trace shows the sign-in call succeed (HTTP 200, a valid session is issued), and then every single data request immediately after it fails with:

`401 — JWT issued at future`

The freshly issued token is stamped about a second ahead of the clock on the API side, so the API rejects it for a moment as "from the future". The very first thing the app loads after sign-in is your church membership. That request fails, the app reads the empty result as "this account isn't linked to any church", shows that message and signs you straight back out. Hence the loop on `/auth`.

Two separate problems:

1. A brief clock difference makes the first requests after sign-in fail.
2. The app treats a *failed* membership lookup the same as *no membership*, and force-signs-out on it. That turns a one-second hiccup into a lockout.

## The fix

1. **Retry instead of failing.** When a request comes back with the "JWT issued at future" error, wait briefly and retry it (short backoff, a couple of attempts). By then the clocks agree and the request succeeds.

2. **Delay the first data load slightly after sign-in** so the token is never used within its skew window.

3. **Never sign out on an error.** Only force sign-out when the membership lookup *succeeded* and genuinely returned nothing. If the lookup errored, show a "Couldn't load your account — retry" state with a retry button and keep the session.

4. **Surface the real reason.** If it still fails after retries, the message should say the account couldn't be verified right now, not "no church access".

## Technical notes

- Add a small retry helper (e.g. `src/lib/supabase-retry.js`) that detects `code === "PGRST303"` / `message` containing `JWT issued at future` and retries after ~750ms, up to 3 attempts.
- Apply it to the `Promise.allSettled` block in `fetchUserData` (`src/hooks/useAuth.jsx`) — profiles, user_roles, unit_leader_assignments, members, tenant_memberships.
- Track fetch failure in `useAuth` (e.g. `dataError`) and expose it alongside `dataLoaded`.
- In `src/pages/Auth.jsx`, gate both the auto-sign-out effect (line ~58) and the render-time safety net (line ~174) on `!dataError`; render a retry card when `dataError` is set.
- The same guard belongs on the `refetchMemberForTenant` path so tenant switching doesn't hit it.

No database or auth-configuration changes are needed.
