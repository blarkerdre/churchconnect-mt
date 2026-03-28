

## Change: Link/Unlink Members by Email Only

### Current behavior
- **Link**: Admin clicks "Link Account", searches profiles list by name/email, clicks to link
- **Unlink**: Works fine (just clears `user_id`)

### Requested change
Replace the profile-list-based linking with a simple **email input** approach:
- Admin types an email address
- System looks up the auth user by email (via `profiles` table)
- If found, links the member to that user
- If not found, shows a clear error message

### Plan

#### 1. Update `src/components/members/MemberFormDialog.jsx`

Replace the current link flow (lines 491-537) which queries all profiles and shows a searchable list:

**Remove**: The `allProfiles` query (lines 91-99), `filteredProfiles` filter (lines 137-141)

**Replace with**:
- A simple email input field + "Link" button
- On click, query `profiles` table for exact email match within the tenant
- If found, call `linkAccountMutation` with that user's `user_id`
- If not found, show toast error: "No user account found with this email"

The unlink flow stays unchanged — it already works correctly.

### Files to change
- `src/components/members/MemberFormDialog.jsx` — replace profile list search with email-based lookup and link

