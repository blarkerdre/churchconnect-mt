

## Plan: Data Export/Backup + Soft-Delete with Recovery

### Overview
Add two capabilities to the Danger Zone: (1) export all tenant data as CSV before purging, and (2) soft-delete data into an archive table with a 30-day recovery window instead of immediate permanent deletion.

---

### 1. Database Migration

Create a new `purged_data_archives` table to store soft-deleted snapshots:

```sql
CREATE TABLE public.purged_data_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  purged_by uuid NOT NULL,
  purged_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  status text NOT NULL DEFAULT 'archived', -- 'archived' | 'restored' | 'expired'
  data jsonb NOT NULL, -- all tenant data as JSON
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purged_data_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage archives"
  ON public.purged_data_archives FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') AND user_has_tenant_access(tenant_id))
  WITH CHECK (has_role(auth.uid(), 'super_admin') AND user_has_tenant_access(tenant_id));
```

### 2. New Edge Function: `export-tenant-data`

- Accepts `tenant_id`, validates super_admin + tenant membership
- Queries all tenant-scoped tables (members, attendance, events, follow-ups, etc.)
- Returns a JSON response with all data organized by table name
- Frontend converts this to CSV files and triggers a ZIP download

### 3. Update Edge Function: `purge-all-data`

- Before deleting, snapshot all tenant data into `purged_data_archives` as a JSON blob
- Proceed with existing tenant-scoped deletion logic
- Return archive ID in response so user knows recovery is possible

### 4. New Edge Function: `restore-purged-data`

- Accepts `archive_id`, validates super_admin + tenant ownership
- Reads the JSON snapshot from `purged_data_archives`
- Re-inserts data into all original tables in FK-safe order
- Marks the archive as `status = 'restored'`

### 5. Frontend: `DangerZoneSection.jsx`

Add two new UI elements:

**Export Button** (before the delete button):
- "Export All Data" button that calls `export-tenant-data`
- Converts response JSON into multiple CSV files
- Bundles into a ZIP download using JSZip library

**Recovery Section** (new card or sub-section):
- Query `purged_data_archives` for active archives for the current tenant
- Show archive date, expiry countdown, and "Restore" button
- "Restore" button calls `restore-purged-data` with confirmation dialog

**Updated Delete Dialog**:
- Add note: "Data will be archived for 30 days and can be restored from this page"
- Show "Export data first" link/button in the confirmation dialog

### 6. Install JSZip dependency

Add `jszip` package for client-side ZIP generation of CSV exports.

---

### Technical Details

**Export tables** (same list as purge): members, attendance_records, attendance_sessions, followups, pastoral_care, events, event_registrations, announcements, messages, notifications, sms_log, email_send_log, transportation, documents, first_timers, member_status_history, training_completions, training_reports, church_attendance_reports, exam_answers, exam_attempts, course_registrations, wsf_attendance, wsf_attendance_reports, unit_leader_assignments, audit_log.

**Archive JSON structure**:
```json
{
  "members": [...],
  "attendance_records": [...],
  "followups": [...],
  ...
}
```

**Restore order** (reverse of delete -- parents first): members, attendance_sessions, attendance_records, events, event_registrations, etc.

**Automatic expiry**: Archives older than 30 days can be cleaned up via a scheduled function or checked at query time (filter `expires_at > now()`).

### Files Changed
- **New migration**: `purged_data_archives` table
- **New edge function**: `supabase/functions/export-tenant-data/index.ts`
- **New edge function**: `supabase/functions/restore-purged-data/index.ts`
- **Edit**: `supabase/functions/purge-all-data/index.ts` -- add archival step before deletion
- **Edit**: `src/components/settings/DangerZoneSection.jsx` -- add export button, recovery UI, updated messaging
- **Install**: `jszip` package

