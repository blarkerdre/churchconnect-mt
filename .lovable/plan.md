## Plan: Create Demo Church (TEST) Tenant

### What We'll Do

Use the existing `register-tenant` edge function to create a test tenant with a super admin account. This function handles everything atomically: tenant record, auth user, tenant membership, user role, and profile.

### Steps

1. **Invoke the `register-tenant` edge function** with:
  - `church_name`: "Demo Church (TEST)"
  - `slug`: "demo-test"
  - `admin_email`: your email ([kugbiyiadeniyi@gmail.com](mailto:kugbiyiadeniyi@gmail.com))
  - `admin_password`: a password you choose
  - `admin_full_name`: "Adeniyi Kugbiyi"
  - `timezone`: "Europe/London"
2. **Verify** the tenant, membership, and roles were created correctly

### What You'll Get

- A tenant at `/t/demo-test/` for safe testing
- A super admin account linked to it
- Full isolation from any future production tenants

### Technical Details

- No code changes or migrations needed
- The edge function creates: tenant row, auth user (or reuses existing), `tenant_memberships` (owner), `user_roles` (super_admin), and updates the profile with `tenant_id`
- The `DEFAULT_TENANT_ID` in `TenantContext.jsx` references `a0000000-0000-0000-0000-000000000001` — after creation, we may want to update this to match the new tenant's actual UUID

### One Question

I need a password for the admin account. What password would you like to use for [kugbiyiadeniyi@gmail.com](mailto:kugbiyiadeniyi@gmail.com)?