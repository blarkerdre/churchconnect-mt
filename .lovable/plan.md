

## Security Fixes: Two Findings

### Finding 1: `sched_comms_member_read` — Already Fixed
The `scheduled_communications` table already has the correct admin/leader-only SELECT policy (`"Admins/leaders can view scheduled communications"`) from the migration just applied. The old permissive policy has been dropped. **No further action needed.**

### Finding 2: `has_role_no_tenant_scope` — Cross-Tenant Escalation via Storage Policies
The `storage.objects` table has 3 policies for `church-documents` and 3 for `book-covers` that use `is_admin(auth.uid())` or `has_role(auth.uid(), 'unit_leader')` — the single/two-argument overloads that check the role globally, not scoped to a tenant. This means a unit_leader in Tenant A can read/upload/delete church documents belonging to Tenant B.

The storage policies cannot directly reference a `tenant_id` column (storage.objects doesn't have one), but the existing `Tenant-scoped read church-documents` policy already demonstrates the pattern: extract the tenant ID from the folder path (`(storage.foldername(name))[1]`) and pass it to tenant-aware functions.

#### Fix — Migration SQL
Replace all 4 unscoped `church-documents` policies and 3 unscoped `book-covers` policies with tenant-scoped versions:

**Church Documents (read/upload/delete):**
```sql
-- Extract tenant_id from path: {tenant_id}/subfolder/file
DROP POLICY IF EXISTS "Admins/leaders can read church docs" ON storage.objects;
CREATE POLICY "Admins/leaders can read church docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
      OR has_role(auth.uid(), 'unit_leader'::app_role, ((storage.foldername(name))[1])::uuid)
    )
  );

-- Same pattern for upload (INSERT) and delete (DELETE)
```

**Book Covers (update/delete):**
```sql
-- Book covers use path: {tenant_id}/filename
DROP POLICY IF EXISTS "Admins can delete book covers" ON storage.objects;
DROP POLICY IF EXISTS "Admins delete book covers" ON storage.objects; -- duplicate
CREATE POLICY "Admins can delete book covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND is_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
-- Same for update
```

The `super_admin` two-argument calls on `profiles`, `tenant_memberships`, and `tenants` are intentionally unscoped — super admins are global by design — so those are left unchanged.

#### Technical Details
- The `is_admin(uuid)` and `has_role(uuid, role)` overloads check role membership globally across all tenants
- The three-argument versions `is_admin(uuid, tenant_id)` and `has_role(uuid, role, tenant_id)` scope the check to a specific tenant
- Storage paths follow `{tenant_id}/...` convention, so `(storage.foldername(name))[1]` extracts the tenant ID

### Files changed
- **Database migration** — drop and recreate 7 storage.objects policies to use tenant-scoped role checks

