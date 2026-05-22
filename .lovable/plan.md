# Harden member registration against cross-account linking

## Root cause (confirmed)

The `public-register` edge function stamps `user_id = authenticatedUser.userId` onto member rows **without verifying the form's email matches the signed-in user's email**. So when Akaninyene Umo was logged in and submitted Sonia Ojilere's registration, Sonia's new member row got Akaninyene's `user_id`.

The signup database trigger (`handle_new_user`) is already safe — it only claims members where `lower(members.email) = lower(NEW.email)` in the resolved tenant. No change needed there.

`public-wofbi-register` does not touch `user_id`, so it's unaffected.

## Fix

In `supabase/functions/public-register/index.ts`, introduce a single guard:

```text
const isSelfRegistration =
  !!authenticatedUser?.userId &&
  !!email &&
  !!authenticatedUser.email &&
  email.trim().toLowerCase() === authenticatedUser.email.trim().toLowerCase();
```

Then apply it in every place that currently writes `user_id`:

1. **Claim-by-email path (~line 521)** — only run the claim/update with `user_id` when `isSelfRegistration` is true. Otherwise fall through to the duplicate-email update path (which does not write `user_id`).
2. **`linkedMember` update path (~line 480)** — this path already requires the member row to be linked to the auth user via `member_id` metadata, so leave it alone (the link was established earlier under a verified flow). Add a defensive check: if the existing row's `email` differs from the auth user's email, skip writing `user_id` updates.
3. **New-member insert path (~line 594)** — set `user_id: isSelfRegistration ? verifiedUserId : null`. Admins/leaders registering someone else will create an unlinked member row, which is the correct outcome.
4. **`ensureTenantAccess` calls** — keep, because tenant membership for the *logged-in admin* is unrelated to which member row was created.

Add a `console.warn` when `authenticatedUser` is present but `isSelfRegistration` is false, so future cross-account submissions are visible in edge logs:

```text
console.warn("public-register: skipping user_id stamp — form email does not match auth user", {
  authEmail: authenticatedUser.email, formEmail: email
});
```

## Out of scope

- No DB migration. The trigger is already correct, and `members.user_id` already allows NULL.
- No retroactive scan of existing mis-linked rows (we only know about Sonia; can be a follow-up if you want a sweep).
- No UI changes. Admins registering someone else will still see the success state; the member just won't be auto-linked to the admin's login.

## Verification

1. Akaninyene logs in → opens public registration form → enters someone else's email → submits. Expect: new member row has `user_id = NULL`, Akaninyene's Dashboard is unaffected.
2. A new visitor signs up via `/auth` with email `x@example.com` → trigger auto-claims any existing member row in the resolved tenant where `lower(email) = 'x@example.com'`. Unchanged behaviour.
3. An already-authenticated user re-submits the registration form with their own email → `isSelfRegistration` is true → claim path links them. Unchanged behaviour.
