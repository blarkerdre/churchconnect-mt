# Why Benedicta Ross and others show as "not in the member directory"

## What the data actually shows

The Members page notice lists every account that has access to the church but has **no directory record linked to that account**. In Cardiff, 12 accounts match. They fall into two very different groups.

**Group A — duplicate / mistyped account (2 people)**

| Person | Sign-in account email | Directory record email | Directory record linked to |
|---|---|---|---|
| Benedicta Ross | benedictaross10@gmai**ll**.com | benedictaross10@gmail.com | a different, older account |
| Samuel Bamidele | samuelbamidele0**6**9@gmail.com | samuelbamidele0**5**9@gmail.com | a different, older account |

They *are* in the directory. They signed up again with a slightly different email, creating a second account, and the notice can't see the link because it only compares account IDs — not names or emails.

**Group B — genuinely no directory record (10 people)**

Onyekachi Chime, Success Akanbi, Olayide Oyelowo, Moriike Yagboyaju, Oluwasola Ajani, Felix Mpi, Olalekan Yekini, Juwon Adeniyi, Henry Ibeji and others have an account and church access, but no member record exists for them in any church. The notice is correct for these — an admin needs to add them.

## The fix

**1. Tell the two groups apart**

Before flagging an account, check the directory for a likely existing record by matching on email (case-insensitive, ignoring dots/plus-tags) and on first + last name. Split the notice into two sections:

- **Possible duplicate accounts** — shows the matched directory record next to the account, with a **"Link this account"** action that attaches the new account's user id to the existing member record (and, if the record was linked to an old account, replaces it). No new member row is created.
- **Not in the directory** — the current behaviour, with the existing "Add to directory" action.

**2. Make the wording accurate**

Change the heading from a flat "N accounts … not in the member directory" to a short explanation, so admins know some entries are duplicates to merge rather than people to add.

**3. Nothing to migrate**

No bulk data change. Benedicta and Samuel get resolved by an admin clicking "Link this account"; the other ten by "Add to directory". Optionally an admin can also correct the mistyped email on the account afterwards.

## Technical notes

- `src/pages/Members.jsx`: the `memberships-without-directory` query already fetches memberships, linked member user ids and profiles. Extend it to also select `id, first_name, last_name, email, user_id` from `members` for the tenant, and for each unlinked account compute a `suggestedMember` via normalised-email match first, then case-insensitive full-name match. Return `{ profile, suggestedMember }`.
- Link action: `supabase.from("members").update({ user_id: <account id> }).eq("id", suggested.id).eq("tenant_id", tenantId)` — keep the explicit tenant guard. Invalidate `["members"]` and `["memberships-without-directory"]`.
- Respect the `(user_id, tenant_id)` uniqueness constraint: if another member row in this tenant already holds that user id, surface an error toast instead of a failed write.
- Re-linking overwrites an existing `user_id` on the record, so route it through `useConfirmDelete()`-style password confirmation, consistent with other destructive edits.
