# Add 4,000 demo people across the other churches

Populate every church except Winners Chapel International, Cardiff with realistic demo people so the directory, reports and analytics look like a live platform. Cardiff's real data is untouched.

## What gets created

Directory records only — no sign-in accounts, no logins, no emails ever sent to these people.

| Church | New people |
|---|---|
| Demo Church (TEST) | 100 |
| Winners Chapel International, Croydon | 1,400 |
| Winners Chapel International, NewPort | 1,000 |
| Winners Chapel International, Southampton | 800 |
| Winners Chapel International, Swansea | 700 |

Each person gets: first and last name (mixed UK, Nigerian, Ghanaian, Caribbean and Eastern European names), gender, date of birth spread across all ages, UK mobile number, street address with a city matching the church's location, membership status (mostly Active, with a realistic scattering of First Timer, New Convert, Visitor, Inactive), a church unit, baptism and training flags, consent ticked, and a joining date spread over the past three years.

## Email addresses

Real-looking addresses on the common providers, as requested — for example `grace.adeyemi84@gmail.com`, `t.hughes.91@outlook.com`, `chidi.okonkwo@yahoo.co.uk`.

One caution worth stating plainly: these addresses are invented, so a few may by chance belong to real strangers. If any bulk email or SMS is ever sent from these churches it could reach people who never signed up. Safeguard: every one of these 4,000 records will be created with marketing consent switched off and unsubscribed, so the platform's own messaging rules skip them.

## Member limits must be raised first

Each church has a cap on how many people it can hold, and the caps are far below the new numbers (Demo 500, the others 100 each). Inserting would fail immediately. So the first step raises each of those five churches' caps to comfortably above their new totals. Cardiff's cap is left alone.

## Steps

1. Raise the member cap on the five churches (Cardiff untouched).
2. Generate and insert the 4,000 records in batches, each tagged to its own church.
3. Verify: count per church, confirm Cardiff's total is unchanged, and spot-check a handful of records in the directory.

## Technical details

- Data-only change plus a `member_limit` update on five tenant rows; no application code changes.
- Rows go into `public.members` with an explicit `tenant_id` per batch; `user_id` stays null (no auth users, no profiles, no tenant memberships).
- Insert triggers on `members` will fire: audit logging, status history and automatic follow-up creation for First Timer / New Convert rows. That is expected and mirrors real usage, but it means several thousand extra `audit_log`, `member_status_history` and `followups` rows. If you would rather keep the follow-up queue clean, say so and the demo data will avoid First Timer / New Convert statuses.
- `enforce_member_limit` is a BEFORE INSERT trigger, hence the cap raise up front.
- Emails will be unique across the whole set; consent columns set to `consent_marketing = false`.
