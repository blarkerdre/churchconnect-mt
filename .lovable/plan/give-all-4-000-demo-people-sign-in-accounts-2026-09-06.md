# Give all 4,000 demo people sign-in accounts

Every one of the 4,000 demo people added across Demo Church (TEST), Croydon, NewPort, Southampton and Swansea gets a working login, linked to their existing directory record. Winners Chapel International, Cardiff is untouched.

## What each person gets

- A sign-in account using the real-looking email already on their record (e.g. `grace.adeyemi84-12@gmail.com`)
- One shared password for all 4,000, given to you in chat
- A profile and church membership, with the "member" role
- Their existing directory record linked to the new account — no duplicate people are created

## The email caution, restated

These addresses are invented, so a small number may by chance match a real stranger's address. The accounts are created pre-confirmed, so no confirmation or welcome email is ever sent. All 4,000 records already have marketing consent switched off, so the platform's bulk email and SMS rules skip them. If you ever want to be certain nothing can reach a real inbox, say so and the logins can use a clearly-fake domain instead.

## How it runs

Accounts are created one at a time through the same admin function your User Management page uses, so all the correct linking, role assignment and audit logging happen exactly as they would for a real invite. At roughly one per second this takes around an hour, so it runs in the background in batches per church while progress is reported.

Expect it to add roughly 4,000 sign-in records, 4,000 profiles, 4,000 church memberships and 4,000 audit entries.

## Steps

1. Run the creation job church by church, starting with Demo Church (TEST) as a 100-person trial run to confirm linking works.
2. Continue through Croydon, NewPort, Southampton and Swansea, reporting progress and any failures.
3. Verify: each church's account count matches its people count, every new account links to exactly one existing person, and Cardiff's totals are unchanged.
4. Report the shared password and any addresses that failed (for example if one collides with an account that already exists).

## Technical details

- Driver script in `/tmp`, authenticated with a minted super-admin session, calling the `admin-create-user` Edge Function once per person with `tenant_id` and no `member_data`, so `auto_link_member_by_email` attaches the existing `members` row instead of inserting a new one.
- Runs in the background with a progress log, polled between turns (single commands cap at 600s).
- Retries on transient failures; duplicate emails are reported rather than silently reusing an unrelated account.
- No application code or schema changes.
