

## Fix: "No church context found" Error on My Profile Page

### Root cause
The `CreateMemberProfile` component in `MyProfile.jsx` checks `tenantId` from `useTenantQuery()` before creating a profile. If the tenant context hasn't resolved (e.g., user accesses `/my-profile` without a tenant slug