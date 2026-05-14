
# Security Hardening Plan

Addresses the open security findings. One finding (register-tenant rate limiting) is intentionally skipped — the platform does not yet have rate-limiting primitives, and the policy is to defer ad-hoc implementations.

## 1. Followup scheduled messages — recipient PII exposure (error)

**Problem:** `followup_scheduled_messages` SELECT policy lets any creator read `recipient_phone` / `recipient_email`.

**Fix (migration):**
- Drop the broad "Assigned users can manage own followup messages" SELECT policy.
- Replace with split policies:
  - SELECT for admins and unit leaders (tenant-scoped) — full row.
  - SELECT for `created_by = auth.uid()` — keep, but expose only via a SECURITY DEFINER view `followup_scheduled_messages_safe` that omits `recipient_phone` / `recipient_email`. Update the followups UI to read the safe view for the "my scheduled messages" listing.
- INSERT/UPDATE/DELETE policies for the creator remain unchanged.

## 2. `tenant-pwa-icons` bucket — any member can write/delete (error)

**Fix (migration):** Drop existing INSERT/UPDATE/DELETE storage policies on `tenant-pwa-icons` and recreate them using `is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)`, mirroring `tenant-branding`.

## 3. Unscoped `is_admin(uuid)` overload (error)

**Fix (migration):**
- Audit all policies/functions referencing the single-arg `is_admin(uuid)`. Rewrite each to `is_admin(auth.uid(), tenant_id)` against the row's `tenant_id`.
- Then `DROP FUNCTION public.is_admin(uuid)` to eliminate the footgun.
- If any caller cannot resolve a tenant_id (e.g. cross-tenant super-admin checks), switch them to `has_role(auth.uid(), 'super_admin')` explicitly.

## 4. Raw `err.message` in edge functions (warn)

**Fix (code):** In `admin-toggle-user`, `admin-delete-user`, `admin-create-user`, `archive-tenant`, `admin-list-banned-users`, `manage-tenant-subscription`, replace 500-path `err.message` returns with `console.error(...)` plus a generic `{ error: "An unexpected error occurred" }`. Preserve user-facing 400/403 messages that are intentional.

## 5. `public-wofbi-register` hardcoded tenant fallback (warn)

**Fix (code):** Remove `DEFAULT_TENANT_ID`. Have `resolveTenantId` return `null` when neither id nor slug resolves; respond with HTTP 400 `"Missing tenant context"`, mirroring `public-register`.

## 6. `wsf_attendance_reports` over-broad SELECT (warn)

**Fix (migration):** Drop "Authenticated can view wsf reports" and replace with:
- Admins (tenant-scoped) — all rows.
- Unit leaders for the WSF unit — all rows.
- WSF centre leader — only rows where `wsf_centre_id` matches a centre they lead (`is_home_cell_leader_for_centre`).

## 7. `church-documents` bucket public flag verification (warn)

**Fix (migration):** Set `storage.buckets.public = false` for `church-documents`. Confirm the app already uses signed URLs for certificates (it does — `useSignedMemberPhoto` pattern is the precedent); otherwise add signed-URL retrieval where direct public URLs are used. Update the security memory accepted-risk note accordingly.

## 8. `exam_titles` anon cross-tenant exposure (warn)

**Fix (migration):** Drop the unscoped "Anon can view active courses with open registration" policy. Replace with a SECURITY DEFINER RPC `get_public_courses_for_tenant(_tenant_id uuid)` that returns active+open courses for a single tenant, and update `PublicWoFBIRegistration.jsx` to call it. Anonymous direct table reads on `exam_titles` are then removed.

## Skipped

- **`register_tenant_ratelimit`** — Platform-level rate limiting primitives are not available; per current Lovable policy, do not add ad-hoc rate limiting. Will be revisited when infrastructure is in place.

## Technical Notes

- All new policies and functions follow the existing pattern: `SECURITY DEFINER`, explicit `SET search_path = public`, tenant-scoped checks via `is_admin(uid, tenant_id)` / role helpers.
- After migrations, mark each finding fixed via `security--manage_security_finding` with the relevant explanation, and update `security--update_memory` to reflect the new posture (private `church-documents` bucket, removal of `is_admin(uuid)` overload, scoped exam_titles access, deferred rate limiting).
- No frontend behavior changes beyond: followups "my messages" view reads safe view; public WoFBI registration must include `tenant_slug` (already does in normal flows).
