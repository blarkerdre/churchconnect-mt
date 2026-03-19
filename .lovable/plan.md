

## Combined User Account + Member Profile Registration

### What
Add an optional "Create User Account" toggle to the existing Member Registration form (`MemberFormDialog`). When enabled by an admin, it will create both a user account (via the `admin-create-user` Edge Function) and a member profile in one step, automatically linking them.

### How

**1. Update `admin-create-user` Edge Function**
- After creating the user account, also create a linked member record in the `members` table using the service role client
- Accept additional member fields: `first_name`, `last_name`, `phone`, `gender`, `membership_status`, `church_unit`, `address`, `city`, `postcode`, `date_of_birth`, etc.
- Set `members.user_id` to the newly created user's ID
- Return both `user_id` and `member_id` in the response

**2. Update `MemberFormDialog.jsx`**
- Add a "Also create user account" checkbox/switch (visible only for admins when creating a new member, not editing)
- When toggled on, show additional fields: **Password** and **Role** (dropdown: member, unit_leader, wsf_leader, admin — restricted by caller's permission level)
- On save, if the toggle is on:
  - Call `admin-create-user` with both user fields (email, password, role) and member fields
  - Skip the separate member insert (the Edge Function handles it)
- If the toggle is off, keep the existing flow (insert member only)
- Email field becomes required when "create account" is enabled

**3. Validation**
- Email is required when creating an account
- Password must be at least 6 characters
- Role selection required

### Technical Details

**Edge Function changes** (`supabase/functions/admin-create-user/index.ts`):
- Add optional `member_data` object to the request body
- After user creation, if `member_data` is present, insert into `members` table with `user_id` set to the new user's ID
- Use service role client for the insert (bypasses RLS)

**Frontend changes** (`src/components/members/MemberFormDialog.jsx`):
- New state: `createAccount` (boolean), `password` (string), `accountRole` (string)
- Conditional UI section between Personal Details and Church Growth
- Modified `handleSave` to branch based on `createAccount` flag

### Files Modified
1. `supabase/functions/admin-create-user/index.ts` — accept member data, create linked member
2. `src/components/members/MemberFormDialog.jsx` — add account creation toggle and fields

