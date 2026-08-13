# Why blarkerdre@yahoo.com is invisible in the invited church

## What the data shows

- The invite worked. They hold memberships in **both** churches: Winners Chapel International, Cardiff (since 23 Jul) and Demo Church (TEST) (added 13 Aug, role `member`).
- Their **profile row** is stamped with a single church — Cardiff — because a profile is created once, at signup, in the church they joined first.
- They have a **member directory record only in Cardiff**; none exists in Demo Church.

So two separate lists both exclude them:

| List | Reads from | Why they're missing |
|---|---|---|
| User Management | `profiles`, filtered by the active church | Their profile carries Cardiff's church id, so Demo Church filters it out |
| Members | `members`, filtered by the active church | No directory record was ever created for Demo Church |

This is not specific to this person — **any user invited into a second church is invisible there**, in both lists.

## The fix

**1. User Management lists people by church membership, not by profile origin**

Change the user list to be driven by the church's membership records (`tenant_memberships`) joined to profiles, instead of filtering profiles by their stamped church. Result: everyone who belongs to the active church appears, regardless of where they originally signed up. Role management, MFA reset and enable/disable keep working per user as they do today, still scoped to the active church.

Show each row's church role (Owner / Admin / Member) so admins can see how the person got in.

**2. Make the missing directory record visible and fixable**

In the Members page, add an admin-only notice listing people who belong to this church but have no member record yet, with an "Add to directory" action that opens the existing member form pre-filled with their name and email and links it to their account. No silent auto-creation — a directory record carries pastoral data an admin should own.

**3. One-off**

Nothing to patch for this person specifically; once (1) ships they appear in Demo Church's User Management, and (2) lets an admin add them to the directory if wanted.

## Technical notes

- `src/pages/UserManagement.jsx`: replace the `profiles` query (currently `scopeQuery(from("profiles"))`) with a query on `tenant_memberships` filtered by `tenant_id`, selecting the related profile. Keep every write path explicitly `.eq("tenant_id", tenantId)`.
- Verify `tenant_memberships` RLS lets a church admin read the rows for their own church; add a policy scoped via the existing `is_tenant_admin` / tenant-access helper only if the read is currently blocked. No schema change.
- `src/pages/Members.jsx`: derive the "in this church but not in the directory" set by comparing church memberships against `members.user_id` for the active church; reuse `MemberFormDialog` for the add action.
- `profiles.tenant_id` stays as-is (signup origin) — it is not the source of truth for church membership.
