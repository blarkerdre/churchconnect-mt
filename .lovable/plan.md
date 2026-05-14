## Audit summary

| Limit | Column | Status |
|---|---|---|
| SMS monthly | `tenants.sms_limit_monthly` | **Broken** — counter returns 0 |
| WhatsApp monthly | `tenants.whatsapp_limit_monthly` | **Broken** — same root cause |
| Storage | `tenants.storage_limit_mb` | **Not enforced** — column unused |
| Members | `tenants.member_limit` | **Not enforced** — only displayed |

## 1. Fix SMS / WhatsApp quota counter (silent bug)

**Bug:** `send-sms/index.ts` (line 218–224) counts `sms_log` rows where `status='sent'`. The Twilio status webhook updates the row to `delivered` (or `failed`), so the count is always 0 once delivery callbacks arrive. Live data confirms: 83 `delivered`, 1 `failed`, 0 `sent` this month → quota effectively unlimited.

**Fix:** Count anything that consumed quota (i.e., not `failed`):

```ts
.from("sms_log")
.select("*", { count: "exact", head: true })
.eq("tenant_id", tenant_id)
.eq("channel", msgChannel)
.neq("status", "failed")
.gte("created_at", monthStart.toISOString());
```

Also update the post-send `responseBody.remaining` math to use the same definition.

## 2. Storage limit enforcement

**Approach:** Compute live usage from `storage.objects` for buckets owned by the tenant, then gate uploads via a SECURITY DEFINER RPC and surface usage in the UI.

**Database:**
- New SQL function `public.get_tenant_storage_usage_mb(_tenant_id uuid)` (SECURITY DEFINER, search_path=public,storage) that sums `(metadata->>'size')::bigint` across `storage.objects` filtered by tenant‑scoped path prefixes:
  - `profile-photos`: objects whose name starts with `<tenant_id>/`
  - `church-documents`: same prefix convention (verify; may already use it)
  - `tenant-branding`: filter by tenant prefix
  - `book-covers`: filter by tenant prefix
- New SQL function `public.check_tenant_storage_quota(_tenant_id uuid, _added_bytes bigint)` returning `boolean` — used by client + edge for pre-upload check.
- Optional materialized convenience: cached column `tenants.storage_used_mb` updated by a trigger on `storage.objects` (insert/delete) — defer; live computation is fine for MVP.

**Client gate (frontend pre-flight):**
- New helper `src/lib/storageQuota.js` exporting `assertStorageAvailable(tenantId, fileSize)` that calls `check_tenant_storage_quota` RPC and throws a friendly error.
- Wrap every existing upload site (member photo upload in `MemberFormDialog`, profile in `MyProfile`, document uploads, banner/branding uploads, book covers).

**UI:**
- Add a **Storage** progress card to `Settings.jsx` (tenant admin section) and to `TenantAnalyticsTab.jsx` showing `<used> / <limit> MB` with the same bar pattern used for `member_limit`.

## 3. Member limit enforcement

**Database:**
- SECURITY DEFINER function `public.check_tenant_member_quota(_tenant_id uuid)` returning `boolean`.
- Trigger `members_enforce_member_limit` BEFORE INSERT on `public.members`: if `member_limit > 0` and active member count >= limit, raise `EXCEPTION 'Member limit reached for this tenant'`. Skips when `member_limit = 0` (unlimited).

**Client UX:**
- `MemberFormDialog.jsx` and `BulkImportDialog.jsx`: catch the new error code and show a clear toast: "Member limit reached. Upgrade plan or raise the limit in Tenant Admin."
- Public registration paths: surface the same friendly message instead of a generic failure.

**No UI changes needed in TenantAnalytics** — the existing member usage progress bar already exists.

## Technical details

- All edits keep multi-tenancy guards: every new RPC takes `_tenant_id` explicitly; quota checks scoped via `tenant_id`.
- New trigger uses `SET search_path = public` per project convention.
- No schema changes to `tenants` table required (limits already exist).
- Edge function redeploy: `send-sms` only.
- Files touched:
  - `supabase/functions/send-sms/index.ts` (quota query fix)
  - New migration: storage + member quota functions and member trigger
  - `src/lib/storageQuota.js` (new)
  - `src/components/members/MemberFormDialog.jsx`, `BulkImportDialog.jsx` (member-limit error handling, profile-photo pre-flight)
  - `src/pages/MyProfile.jsx` (photo upload pre-flight)
  - Document/banner/book-cover upload sites (pre-flight)
  - `src/pages/Settings.jsx` and `src/components/tenants/TenantAnalyticsTab.jsx` (storage usage bar)
- Memory update: amend `mem://features/messaging-quotas` to reflect the corrected counter, and add a new memory `mem://features/storage-and-member-quotas` describing the enforcement model.

## Out of scope

- Plan-tier auto-billing changes
- Hard storage cleanup / pruning policies
- Per-bucket sub-quotas
