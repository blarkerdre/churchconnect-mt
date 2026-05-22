# Fix mis-linked member: Sonia Ojilere

## What's wrong

The member **Sonia Ojilere** (`chidimmasonia1@gmail.com`, tenant: Winners Chapel International, Cardiff) has `user_id` pointing to the auth account **viakanum1@gmail.com** (Akaninyene Umo).

That means whenever Akaninyene logs in, the app treats him as Sonia — his Dashboard, "My Profile", certificates, and any "member-self" views all resolve to Sonia's record.

There is **no auth account** for `chidimmasonia1@gmail.com`, so Sonia herself has never actually logged in.

## Why this happened

Timeline from the database:

- 2026-04-11 10:17:17 — auth user `viakanum1@gmail.com` (Akaninyene Umo) is created.
- 2026-04-11 10:30:37 — member row for **Sonia Ojilere** is created, and at that moment `user_id` is set to Akaninyene's auth id.

Two plausible mechanisms, both consistent with the data:

1. **Signup trigger mis-attribution.** When Akaninyene signed up, our `handle_new_user` / signup trigger looks for an existing member row to attach the new auth user to (by email / name match in the active tenant context). If the trigger's match was loose (e.g. name-only fallback, or stale `tenant_slug` metadata) it could have attached his new auth id to the wrong member — Sonia — instead of creating/linking his own.

2. **Self-registration while signed in as someone else.** Akaninyene was logged in and used the public member registration form to register Sonia. The registration path (`public-register` edge function or the in-app member form) wrote `user_id = auth.uid()` onto Sonia's new member row, because it assumes the submitting user *is* the member.

Either way the root cause is the same class of bug: an auth user id is being attached to a member row that doesn't belong to them, with no email-match safeguard.

## Fix — two parts

### 1. Data fix (immediate)

Clear the bad link on Sonia's member row so she's no longer "owned" by Akaninyene's login. Also make sure Akaninyene has his own member row in the same tenant (if he doesn't, he'll need one or an invitation, but that's a separate decision — flagged below, not done in this migration).

```sql
UPDATE public.members
SET user_id = NULL,
    updated_at = now()
WHERE id = '9d5b1664-03b0-4d80-9ea1-540f5a56c7bf'
  AND user_id = 'ce5fca97-2c75-4149-a0c3-6361055526cd';
```

After this:
- Sonia's member record is "unlinked" — admins can re-link it later when Sonia actually signs up with `chidimmasonia1@gmail.com`.
- Akaninyene's login still works; he just won't be auto-mapped to any member until a correct link is made.

### 2. Open question (not part of this migration)

Does Akaninyene Umo have his own member record in WCI Cardiff that *should* be linked to `viakanum1@gmail.com`? I can check and, if so, link his auth id to that row in a follow-up step. If he doesn't have a member record yet, we should decide whether to create one or treat him as admin-only.

## Out of scope here

- No changes to the signup trigger or `public-register` logic in this pass — those need a separate hardening plan (require email match between auth user and member before linking). Happy to write that next if you want.
- No notification sent to either user.

## Verification

After the migration runs:

```sql
SELECT id, first_name, last_name, email, user_id
FROM members
WHERE id = '9d5b1664-03b0-4d80-9ea1-540f5a56c7bf';
```

Expect `user_id` to be `NULL`. Then ask Akaninyene to refresh — his Dashboard should no longer show Sonia.
