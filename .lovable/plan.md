## Make Modules section fully read-only in Settings

### Change
`src/components/settings/TenantFeaturesSection.jsx`:
- Set `canEdit = false` for all users (no role can edit from Settings).
- Update read-only notice to: "Read-only — module availability is managed by the platform."
- Switches stay visible but `disabled`; Save button is hidden (existing `{canEdit && ...}` guard already handles this).
- Keep `canManage` visibility gate so the section continues to render for owners/admins.

### Out of scope
- No backend/RLS changes (server-side write policies already enforce permissions).
- No changes to Tenant Admin or Super Admin module management surfaces.