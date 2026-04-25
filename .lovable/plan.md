# DomiFort Integration — Super Admin scope

Re-scoped from per-tenant Settings to a **global, super-admin-only** feature. Lives as a new **Integrations** tab inside `/tenant-admin` (already gated by `SuperAdminRoute`). Tokens are global (not tied to any single tenant). Ingested bookings are stored in a global table only super admins can see.

## 1. Database (new migration)

### `domifort_api_tokens` (global — no `tenant_id`)
- `id` uuid pk
- `label` text not null — human name (e.g. "DomiFort Production")
- `token_hash` text not null unique — SHA-256 of the bearer token (plaintext never stored)
- `token_prefix` text not null — first 8 chars of plaintext, for display/identification
- `signing_secret_hash` text not null — SHA-256 of HMAC signing secret
- `signing_secret_prefix` text not null
- `is_active` boolean default true
- `created_by` uuid (auth user)
- `created_at`, `last_used_at`, `revoked_at` timestamps
- `request_count` integer default 0

**RLS:** only `has_role(auth.uid(), 'super_admin')` can SELECT/INSERT/UPDATE/DELETE. Edge function uses the service role to bypass RLS for token verification.

### `domifort_bookings` (global)
Mirrors the schema DomiFort posts at `src/routes/api/public/cms/bookings.ts`. Until we see their exact payload, we provision the canonical fields commonly used by booking systems:
- `id` uuid pk
- `external_ref` text not null unique — DomiFort's booking id (used for upsert key)
- `status` text — e.g. confirmed/cancelled/pending
- `customer_name`, `customer_email`, `customer_phone`
- `service_type` text
- `booking_start`, `booking_end` timestamptz
- `location` text
- `amount_minor` bigint, `currency` text(3)
- `payload` jsonb not null — raw payload for forward-compat
- `tenant_id` uuid nullable — populated only if payload includes a recognised tenant slug/id (best-effort routing); otherwise left null and visible only to super admins
- `received_at`, `created_at`, `updated_at` timestamps
- `source_token_id` uuid references `domifort_api_tokens(id)`

Unique index on `external_ref` so re-deliveries upsert cleanly.

**RLS:** super admins see all rows; tenant admins only see rows where `tenant_id = their tenant` (so when DomiFort routes a booking to a specific church we can later expose it to that tenant if desired). For now the UI only surfaces this to super admins.

### `domifort_ingest_log` (global, append-only)
- `id`, `received_at`
- `token_id` uuid, `signature_valid` boolean, `auth_valid` boolean
- `status_code` int, `external_ref` text
- `error` text, `payload_size` int
- `ip` inet, `user_agent` text

For audit/debugging. Super-admin SELECT only.

### Trigger
`updated_at` auto-update trigger on `domifort_bookings`.

## 2. Edge functions

### `domifort-bookings-ingest` (public, `verify_jwt = false`)
Endpoint: `https://<project>.supabase.co/functions/v1/domifort-bookings-ingest`

**Auth:**
1. `Authorization: Bearer <token>` — SHA-256 the value, look up active row in `domifort_api_tokens` by `token_hash`.
2. `X-CMS-Signature: <hex>` — HMAC-SHA256 of the raw request body using the token's signing secret. Constant-time compare.
3. Reject on missing/invalid → 401 with generic message; log to `domifort_ingest_log`.

**Body:** accept either a single booking object or `{ bookings: [...] }`. Validate with Zod (required: `external_ref`; everything else optional). Reject >1 MB body.

**Behaviour:**
- For each booking: `upsert` into `domifort_bookings` on `external_ref` conflict, merging known fields and storing the full raw payload in `payload`.
- Best-effort `tenant_id` resolution: if payload contains `tenant_slug` or `tenant_id` matching a row in `tenants`, set it; otherwise null.
- Update `last_used_at`, increment `request_count` on the token row.
- Append a row to `domifort_ingest_log`.
- Respond `200 { received: N, upserted: [{external_ref, id, action}] }`.

**Rate limit:** in-memory per-token sliding window (60 req/min) like `external-api`.

### `domifort-token-create` (super-admin only, `verify_jwt = false` + manual JWT validation)
- Verifies caller's JWT, confirms `super_admin` role via `user_roles` (service-role client).
- Generates plaintext bearer token (`df_live_` + 40 url-safe chars) and signing secret (`whsec_` + 40 url-safe chars).
- Stores SHA-256 hashes + 8-char prefixes; returns plaintext **once** in the response. No way to retrieve later.

### `domifort-token-revoke` (super-admin only)
Sets `is_active=false`, `revoked_at=now()`. (Could also do this directly via the supabase client — but routing through an edge function lets us audit-log centrally.)

`supabase/config.toml` entries to set `verify_jwt = false` for all three.

## 3. Frontend

### New tab in `src/pages/TenantAdmin.jsx`
Add a third top-level tab:
```
<TabsTrigger value="tenants">Tenants</TabsTrigger>
<TabsTrigger value="analytics">Analytics</TabsTrigger>
<TabsTrigger value="integrations">Integrations</TabsTrigger>
```

### New component `src/components/tenants/DomifortIntegrationSection.jsx`
Rendered in the new tab. Sections:

1. **Endpoint info card** — copyable URL, required headers, sample `curl`, sample HMAC code (Node.js + Python snippets), pointing reviewers to `src/routes/api/public/cms/bookings.ts` schema.
2. **Tokens table** — label, prefix (`df_live_abc12345…`), status, last used, request count, created by/at, revoke + delete actions. Tokens display as `<prefix>••••••••` (full plaintext is not in the DB).
3. **Create token dialog** — label input → calls `domifort-token-create` → shows plaintext bearer + signing secret in a one-time reveal panel with copy buttons and a clear "this won't be shown again" warning.
4. **Recent ingest log** (last 50) — collapsible panel showing time, external_ref, signature_valid, auth_valid, status_code, error.
5. **Recent bookings** (last 50) — table of `domifort_bookings` rows: received_at, external_ref, customer_name, status, resolved tenant (if any). Click → JSON payload modal.

### Sidebar / navigation
No change — access is via the existing Tenant Admin entry, which is already super-admin-only.

## 4. Security checklist
- Tokens & secrets stored as SHA-256 hashes (never reversible); plaintext returned only once at creation.
- HMAC verified with constant-time compare on raw request body before JSON parse.
- Bearer + HMAC both required (defence in depth — bearer alone is insufficient).
- All admin endpoints re-validate `super_admin` role server-side; no client-side trust.
- RLS on all three new tables; service role only used inside edge functions.
- Body size cap, per-token rate limit, generic 401 messages to avoid token-existence oracle.
- Full audit trail in `domifort_ingest_log`.

## 5. What I still want to confirm before building
- Exact field names DomiFort sends in their bookings payload — without sight of `src/routes/api/public/cms/bookings.ts` I'll provision the conservative set above and stash everything in `payload jsonb` so nothing is lost. If you can paste the relevant interface/Zod schema, I'll mirror it exactly.
- Whether incoming bookings should ever be visible to individual tenant admins (current plan: super-admin-only, with `tenant_id` column reserved for a future per-tenant view).

Approve and I'll implement migration → edge functions → Tenant Admin tab in that order.