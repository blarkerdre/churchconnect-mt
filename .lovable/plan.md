

## Build REST API Endpoint for External Apps

### Overview
Create a new backend function `external-api` that provides a secure REST API for external applications to query member data and attendance records. Authentication is via API key (stored per tenant), not user sessions.

### Security Model
- Each tenant gets a unique API key stored in `tenant_api_keys` table
- External apps pass the key via `X-API-Key` header
- The key resolves to a `tenant_id`, scoping all queries
- Rate limiting: max 100 requests per minute per key (tracked in-memory)
- Read-only access — no mutations

### Database Changes

**New table: `tenant_api_keys`**
```sql
CREATE TABLE public.tenant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  label text NOT NULL DEFAULT 'Default',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage API keys"
  ON public.tenant_api_keys FOR ALL TO authenticated
  USING (public.is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_tenant_admin(auth.uid(), tenant_id));
```

### Edge Function: `external-api`

**Endpoints** (query param `resource`):

| Request | Description |
|---------|-------------|
| `GET ?resource=members` | List members (supports `?status=Active&limit=50&offset=0`) |
| `GET ?resource=members&id=<uuid>` | Single member |
| `GET ?resource=attendance_sessions` | List sessions (supports `?from=2026-01-01&to=2026-04-16`) |
| `GET ?resource=attendance_records&session_id=<uuid>` | Records for a session |

**Authentication flow:**
1. Read `X-API-Key` header
2. Look up key in `tenant_api_keys` where `is_active = true`
3. If valid, scope all queries to that `tenant_id`; update `last_used_at`
4. Return 401 if invalid

**Response format:**
```json
{ "data": [...], "count": 50, "limit": 50, "offset": 0 }
```

**Sensitive field filtering:** Strips `notes`, `emergency_contact_*`, `address`, `postcode` from member responses to protect privacy.

### UI: API Key Management in Settings

Add a new section in `src/pages/Settings.jsx` (admin-only) called "API Access" where admins can:
- Generate a new API key (with label)
- View existing keys (masked, with copy button)
- Revoke/deactivate keys
- See last-used timestamp

### Files Changed
- **New migration** — `tenant_api_keys` table + RLS
- **New edge function** — `supabase/functions/external-api/index.ts`
- **New component** — `src/components/settings/ApiKeysSection.jsx`
- **Edit** — `src/pages/Settings.jsx` (add API Keys section for admins)

### Technical Details
- Edge function uses `verify_jwt = false` (API key auth, not JWT)
- Config added to `supabase/config.toml`
- Sensitive member fields excluded from API responses
- Pagination defaults: limit 50, max 200

