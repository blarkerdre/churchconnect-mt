## Goal
Replace the instant "Download my data" flow with a request-approve-download workflow. Members submit a request; a tenant admin reviews and approves; the member then downloads their JSON export. Rejected requests block the download.

## Data model (migration)
Add a new tenant-scoped table `data_export_requests`:
- `id uuid pk`, `tenant_id uuid not null`, `user_id uuid not null`, `member_id uuid null`
- `reason text null`, `status text not null default 'pending'` — values: `pending`, `approved`, `rejected`, `downloaded`, `expired`
- `review_note text null`, `reviewed_by uuid null`, `reviewed_at timestamptz null`
- `approved_at timestamptz null`, `expires_at timestamptz null` (approval valid 7 days)
- `downloaded_at timestamptz null`, `created_at timestamptz default now()`

GRANTs: `authenticated` (SELECT/INSERT), `service_role` ALL. Enable RLS:
- Member can SELECT/INSERT own rows in their tenant.
- Tenant admins can SELECT and UPDATE (approve/reject/note) rows in their tenant.
- No DELETE from client.
Add a `BEFORE INSERT` trigger to block a new request if one is already `pending` or unused `approved` for the same `(tenant_id, user_id)`.

## Edge function
Modify `supabase/functions/export-member-data/index.ts` to require an approved request:
- Accept `request_id` in the body; validate JWT; load the row via service role.
- Reject unless `status = 'approved'`, user matches, tenant matches, `expires_at > now()`.
- On success, mark the request `downloaded` with `downloaded_at = now()` (single-use), then return the JSON payload as today.

## UI
`src/pages/MyData.jsx` – Download tab:
- Replace the direct download button with:
  - If no active request: show "Request data download" button (opens a small reason textarea, submits an insert into `data_export_requests`).
  - If `pending`: show status pill "Awaiting admin approval" + submitted date. Disable new requests.
  - If `rejected`: show note; allow a new request.
  - If `approved` and not expired: show "Download my data (JSON)" button that invokes the edge function with `request_id`. After success, show "Downloaded on …".
  - If `downloaded` or `expired`: show status and allow a new request.
- Keep the "3 exports per 24h" limit copy replaced with: "Downloads require admin approval. Approval is valid for 7 days and can be used once."

`src/components/settings/DataRequestsSection.jsx`:
- Add a second card "Data download requests" that lists `data_export_requests` with the same approve/reject dialog pattern used for erasure. No "execute" action — approval is enough; the member does the download.
- Reuse `statusVariant` helper; add `downloaded`/`expired` styling.

## Notifications (in-app only, matches project pattern)
- On member submit: notify tenant admins ("New data download request").
- On admin approve/reject: notify the member.
Use the existing `notifications` insert pattern already used by erasure (mirror `auto_create_followup` / erasure notify path if present; otherwise a lightweight insert from the RLS-allowed client side is fine — implementation detail during build).

## Out of scope
- No changes to erasure flow.
- No SMS/email — in-app notification only, per project convention for lightweight consent workflows.
- No changes to the exported JSON payload structure.

## Verification
- Migration passes linter; RLS blocks cross-tenant reads.
- Member cannot download until admin approves; edge function rejects `pending`/`rejected`/expired/already-downloaded requests.
- Admin approve→member download→row flips to `downloaded`; second download attempt fails.
