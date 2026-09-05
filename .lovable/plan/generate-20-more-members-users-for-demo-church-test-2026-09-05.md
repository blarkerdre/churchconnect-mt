# Generate 20 more members + users for Demo Church (TEST)

## Goal
Add 20 additional demo accounts to **Demo Church (TEST)** (tenant `d8bbbdae-…`, slug `demo-test`), which already has 20 members. Each new account gets:
- A real auth login (so you can sign in as them)
- A profile, tenant membership (role: member), and a linked member record

## How

1. Mint a super-admin session and call the existing `admin-create-user` Edge Function 20 times — the same function the User Management page uses, so all the correct linking, role assignment and audit logging happen automatically.
2. Each person gets realistic, clearly-demo data:
   - Names: varied UK/Nigerian demo names (e.g. "Demo Member 21" style avoided — realistic names so demos look good)
   - Emails: `demo.member21@demochurch.test` … `demo.member40@demochurch.test` (obviously fake, undeliverable)
   - One shared password for all demo accounts, told to you in chat
   - Member fields: mixed genders, membership statuses (mostly Active, a couple of First Timer / New Convert), church units, phone, address, GDPR consent ticked
3. Run a short verification query: confirm 40 members now exist on the tenant and each new user has a profile + membership.

## Notes
- No changes to app code or database schema — this is data-only, via the existing admin function.
- All 20 rows land on Demo Church (TEST) only; the real WCI Cardiff tenant is untouched.
- Demo emails are fake and can never receive mail; sign-in still works because the function pre-confirms them.

## Technical details
- Tenant: `Demo Church (TEST)` — id `d8bbbdae-d9b3-4999-912d-3aa5999884b0`
- Function: `admin-create-user` (verifies caller is admin, creates auth user + profile + membership + member, writes audit log)
- Script lives in `/tmp`, driven with the minted super-admin session token
