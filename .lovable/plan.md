

## Plan: Tenant Logo Upload/Remove + Password Visibility Toggle

### 1. Password visibility toggle on Auth and ResetPassword pages

**Files**: `src/pages/Auth.jsx`, `src/pages/ResetPassword.jsx`

- Add a `showPassword` state boolean
- Add an `Eye`/`EyeOff` icon button inside the password input's relative container (positioned right)
- Toggle between `type="password"` and `type="text"` based on state
- Add padding-right (`pr-10`) to the input so text doesn't overlap the icon

### 2. Tenant logo upload/remove in Settings

**File**: `src/pages/Settings.jsx` (new section or within an existing branding area)

Add a "Church Branding" settings card that allows tenant admins to:

- **View** the current tenant logo (from `currentTenant.logo_url`)
- **Upload** a new logo image via file input to the existing `profile-photos` public bucket (path: `{tenantId}/tenant-logo.{ext}`)
- **Remove** the logo (set `logo_url` to null on the tenants table)
- After upload, update the `tenants` row with the new public URL via `supabase.from("tenants").update({ logo_url }).eq("id", tenantId)`
- Invalidate relevant queries so sidebar and auth page reflect changes

**RLS consideration**: Tenant admins already have update access to their tenant row via `tenant_memberships` role checks. The existing `profile-photos` bucket is public and already has upload policies. We'll use the tenant-prefixed path (`{tenantId}/tenant-logo`) for isolation.

### Technical Details

- **Storage path**: `{tenantId}/tenant-logo.{extension}` in the `profile-photos` bucket
- **Storage RLS**: May need an INSERT policy on `storage.objects` for the `profile-photos` bucket allowing authenticated users to upload to their tenant prefix. Will check existing policies.
- **Tenant update RLS**: Need to verify tenant admins can update their own tenant row. If not, a new RLS policy on `tenants` for UPDATE by tenant admins will be added via migration.
- **No new tables or migrations** needed beyond potential RLS policies

