## Goal

Make certificate templates (and their uploaded background images) fully tenant-scoped so each church manages, uploads, and uses its own templates without cross-tenant collisions.

## Current state

- `certificate_templates.tenant_id` already exists and RLS is tenant-scoped (`is_admin(auth.uid(), tenant_id)` for writes, `user_has_tenant_access(tenant_id)` for reads).
- The Settings UI (`CertificateTemplateSettings`) is already gated behind `canManageTenant` and scopes its queries with `useTenantQuery`.
- Background uploads already go to `church-documents/{tenantId}/certificate-backgrounds/...`.
- **Gap 1 — schema:** `certificate_templates` has a global `UNIQUE (training_type)` constraint. Two tenants cannot both create a "Default" (or any same-named) template — the second one fails.
- **Gap 2 — schema:** `tenant_id` is nullable, allowing a future row to leak globally.
- **Gap 3 — edge function:** `supabase/functions/issue-certificate/index.ts` looks up templates by `training_type` only (no `.eq("tenant_id", tenant_id)`), so a tenant could pick up another tenant's template when the names happen to match.

## Changes

### 1. Database migration

- Drop `certificate_templates_training_type_key` (the global unique).
- Add composite unique `UNIQUE (tenant_id, training_type)` so each tenant has its own namespace.
- Set `tenant_id NOT NULL` (all existing rows already have it).

### 2. Edge function — `supabase/functions/issue-certificate/index.ts`

In the two template lookups (the requested `training_type` and the `"default"` fallback), add `.eq("tenant_id", tenant_id)` so a template is only matched within the issuing tenant.

### 3. UI — no functional change needed

`CertificateTemplateSettings.jsx` already uses `withTenant(...)` on insert and `scopeQuery(...)` on reads. Confirmed sufficient after the schema change; no edits required.

## Out of scope

- Branding/colour/signatory defaults remain as-is.
- Storage bucket policies for `church-documents` are already tenant-prefixed; no policy changes.
- No UI redesign; the Settings → Certificates tab stays where it is.
