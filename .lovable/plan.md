# SLA Download & Sign (Tenant Owner)

Add a Service Level Agreement section inside **Tenant Admin → Billing** where the tenant owner can review the SLA (populated from a Super Admin–managed template with auto-filled tenant details), download it as a PDF, and sign it via type-to-sign (full name + agreement checkbox). Signatures are stored with timestamp, IP, user agent, and the exact template version signed.

## User flows

**Super Admin (global template):**
- New card in Super Admin area (Tenant Admin page, top-level, super-admin only): "SLA Template".
- Rich-text editor (existing TipTap, same as sermon notes / announcements — no react-quill) for the template body.
- Merge tokens supported: `{{tenant_name}}`, `{{tenant_slug}}`, `{{owner_name}}`, `{{owner_email}}`, `{{effective_date}}`, `{{plan_name}}`, `{{app_name}}`.
- Save creates a new immutable version row; the latest active version is what tenants see.

**Tenant Owner (Tenant Admin → Billing tab):**
- New "Service Level Agreement" card at the top of the Billing tab, visible to `isTenantOwner` only (admins see a read-only status line).
- Shows current status: **Not signed** / **Signed on {date} by {name}** / **New version available — re-signature required**.
- Buttons:
  - **Preview** — opens dialog rendering the merged HTML.
  - **Download PDF** — client-side PDF via existing jsPDF/pdf pattern (or `@react-pdf/renderer` if already used; otherwise a lightweight `pdf-lib` render of the merged HTML → plain text with headings).
  - **Sign** — opens type-to-sign dialog:
    - Full-name text input (must match owner's name on file, case-insensitive, trimmed).
    - "I have read and agree to the SLA" checkbox (required).
    - Timestamp shown live.
    - Submit → writes `tenant_sla_signatures` row and closes.
- After signing: card shows signed state with a **Download signed copy** button (PDF regenerated with signature block appended: name, signed_at, IP hash).

## Data model (new migration)

Two new tables in `public`:

**`sla_templates`** — global, super-admin managed:
- `version` (int, unique, monotonically increasing)
- `title` (text)
- `body_html` (text)
- `is_active` (bool)
- `created_by` (uuid → auth.users)
- Grants: `SELECT` to `authenticated`; `ALL` to `service_role`. RLS: all authenticated can read active; only super admins (`has_role(auth.uid(),'super_admin')`) can insert/update.

**`tenant_sla_signatures`** — per-tenant signature ledger:
- `tenant_id` (uuid → tenants, not null)
- `template_version` (int, references `sla_templates.version`)
- `signed_by_user_id` (uuid → auth.users)
- `signed_by_name` (text, as typed)
- `signed_by_email` (text, snapshot)
- `signed_at` (timestamptz, default now())
- `ip_address` (inet, nullable — captured server-side via edge function)
- `user_agent` (text, nullable)
- `merged_body_html` (text — snapshot of exactly what was signed)
- Grants: `SELECT, INSERT` to `authenticated`; `ALL` to `service_role`. RLS: tenant owners can insert for their own tenant; owners/admins of the tenant can read their tenant's rows; super admins can read all.

No UPDATE/DELETE policies — signatures are immutable.

## Files

- **New migration** — creates the two tables, GRANTs, RLS, policies.
- **`src/pages/TenantAdmin.jsx`** — add super-admin "SLA Template" card (TipTap editor, version list, activate button).
- **`src/components/tenants/TenantBillingTab.jsx`** — add SLA card at top with status, Preview, Download, Sign.
- **`src/components/tenants/SLASignDialog.jsx`** (new) — type-to-sign flow.
- **`src/components/tenants/SLAPreviewDialog.jsx`** (new) — renders merged HTML preview.
- **`src/lib/sla.js`** (new) — token-merge helper + PDF generator (uses `jspdf` already in deps; if not, use `pdf-lib`).
- **`supabase/functions/sign-sla/index.ts`** (new edge function) — validates the request, captures `x-forwarded-for` for `ip_address`, inserts the signature row (bypasses client IP spoofing).

## Out of scope
- Drawn signatures / uploaded countersigned PDFs.
- Blocking onboarding (owner is not forced to sign to use the app; a soft banner in Billing surfaces "not signed" or "new version").
- Emailing the signed PDF (can add later).

## Technical notes
- Merge is done in the browser for preview/download, and re-computed server-side in the edge function against the active template version so the stored `merged_body_html` is authoritative.
- The signed PDF appends a signature block; the underlying template HTML is not modified.
- Uses existing `useAuth().isTenantOwner` for gating.
