# Fix "Launch church" registration error

## Cause
The previous fix relied on a "church owner" flag on the new account. The sign-in system only attaches that flag *after* the account row is saved, so the safety check still sees an account with no church and rejects it ("Database error creating new user" - confirmed in the registration logs).

## Fix
1. Add a private, server-only "pending church owner" list (email + expiry, 10 minutes). No one in the app can read or write it.
2. The church registration function adds the owner's email to this list just before creating the account, and removes it afterwards (success or failure).
3. The signup safety check lets the account through only when the email is on that list (and not expired), then removes the entry. Ordinary signups without a church link stay blocked.
4. Remove the old flag check that never worked.

## Verify
- Run a real test registration via the function, confirm the church and owner are created, then delete the test church.
- Confirm a plain signup without a church link is still rejected.

## Technical
- Migration: `public.tenant_owner_provisioning(email citext pk, expires_at timestamptz)`, RLS on, no policies, revoke from anon/authenticated.
- `handle_new_user`: `DELETE ... WHERE lower(email)=lower(NEW.email) AND expires_at>now() RETURNING` -> if found, insert profile with null tenant and return.
- `register-tenant/index.ts`: upsert row before `createUser`, delete in finally; redeploy.
