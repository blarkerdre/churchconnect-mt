

## Tenant-Scoping Audit: Follow-ups, Email Alerts, and Components

### Summary

After auditing the codebase, the follow-up automation trigger (`auto_create_followup`), follow-up edge functions, and email alert system are **already well tenant-scoped**. However, there are a few specific gaps that need fixing.

### Gaps Found

#### 1. `FollowupDetailPanel.jsx` — "Convert to Active" missing tenant scope
Line 82: `supabase.from("members").update(...).eq("id", followup.member_id)` — missing `.eq("tenant_id", tenantId)`. This could theoretically update a member in another tenant.

#### 2. `FollowupDetailPanel.jsx` — Cancel message missing tenant scope
Line 359: `supabase.from("followup_scheduled_messages").update(...).eq("id", sm.id)` — missing `.eq("tenant_id", tenantId)` guard.

#### 3. `BulkImportDialog.jsx` — Bulk update missing tenant scope
Line 147: `supabase.from("members").update(updateData).eq("id", id)` — missing `.eq("tenant_id", tenantId)`. Inserts use `withTenant()` correctly, but updates don't scope by tenant.

### What's Already Correct

- **`auto_create_followup` trigger**: Fully tenant-scoped — propagates `NEW.tenant_id` to followups, scheduled messages, notifications, and edge function calls. Unit pool queries filter by `NEW.tenant_id`.
- **`send-email-alert` edge function**: Already requires `tenant_id`, validates caller belongs to tenant, and filters members by `tenant_id`.
- **`process-scheduled-followups` edge function**: Already resolves tenant name per message for branding.
- **`notify-followup-assignment` edge function**: Already receives and uses `tenant_id` for branding, email, and SMS.
- **Followups page**: All queries use `scopeQuery()` and mutations use `withTenant()` / `.eq("tenant_id", tenantId)`.
- **FollowupMessageDialog**: Uses `withTenant()` for inserts and `.eq("tenant_id", tenantId)` for updates.

### Fix Plan

#### File 1: `src/components/followups/FollowupDetailPanel.jsx`
- Line 82: Add `.eq("tenant_id", tenantId)` to the member status update
- Line 359: Add `.eq("tenant_id", tenantId)` to the scheduled message cancellation

#### File 2: `src/components/members/BulkImportDialog.jsx`
- Line 147: Add `.eq("tenant_id", tenantId)` to the member update in bulk import

### Files changed
- `src/components/followups/FollowupDetailPanel.jsx` — add tenant scoping to 2 queries
- `src/components/members/BulkImportDialog.jsx` — add tenant scoping to bulk update

