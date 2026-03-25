

## Plan: Seed Test Environment with Distinct Demo Data

### Current State
Both Test and Live environments are identical: 13 members with no `tenant_id`, 0 tenants, 0 tenant memberships. The app is non-functional because tenant context is required.

### What We'll Do

**Step 1: Create a Test tenant**
- Insert a tenant named **"Demo Church (TEST)"** with slug `demo-test` into the Test environment
- This distinct name will immediately differentiate it from Live

**Step 2: Link your user to the tenant**
- Create a `tenant_memberships` record for your user (`932364f2-...`) as `owner`
- Update your `user_roles` to include the tenant_id
- Update your profile with the tenant_id

**Step 3: Assign existing 13 members to the test tenant**
- Update all members with `tenant_id IS NULL` to belong to the new tenant

**Step 4: Seed additional demo data unique to Test**
- **5 extra demo members** with obvious test names (e.g., "Test User Alpha", "Test User Beta") so you can spot them
- **2 attendance sessions** with a few attendance records
- **2 upcoming events** (e.g., "TEST - Youth Rally", "TEST - Prayer Meeting")
- **1 announcement** marked "[TEST] Welcome to Demo Church"

This gives Test visibly different content from Live, making it easy to tell which environment you're in.

### Technical Details

All inserts will use the database insert tool targeting the Test environment. The tenant ID will be a fixed UUID (e.g., `a0000000-0000-0000-0000-000000000001`) matching the `DEFAULT_TENANT_ID` constant in `TenantContext.jsx`. All seeded records will reference this tenant.

No schema changes or code changes are needed — this is purely a data seeding operation.

