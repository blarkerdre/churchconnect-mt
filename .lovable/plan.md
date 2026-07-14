## Goal
Let tenant admins/owners delete individual lecturer feedback entries from the Bible School → Lecturer Feedback report.

## Changes

### 1. Database (migration)
Add a DELETE RLS policy on `lecturer_ratings` for admins/owners:

```sql
CREATE POLICY "Admins can delete tenant ratings"
ON public.lecturer_ratings
FOR DELETE
TO authenticated
USING (
  user_has_tenant_access(tenant_id) AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.user_id = auth.uid()
        AND tm.tenant_id = lecturer_ratings.tenant_id
        AND tm.role = ANY (ARRAY['owner'::tenant_role, 'admin'::tenant_role])
    )
  )
);
```

Existing "Students can delete own rating" policy stays (students can still withdraw their own submission).

### 2. UI — `src/components/exams/LecturerFeedbackReport.jsx`
- Add a new **"Entries"** tab (alongside By lecturer / subject / course / distribution).
- Table columns: Date, Lecturer, Subject, Course, Student, Rating, Have again, Comment (truncated), Actions.
- Uses the already-fetched `filtered` array so all filters apply.
- Only visible to tenant admins/owners/super admins (via `useAuth().isTenantAdmin || isTenantOwner || isSuperAdmin`).
- Actions cell has a Trash icon button that opens `PasswordConfirmDialog` (existing component) requiring password re-auth.
- On confirm: `supabase.from("lecturer_ratings").delete().eq("id", r.id).eq("tenant_id", tenantId)`, then `logAudit("lecturer_rating_delete", "lecturer_ratings", id, { lecturer, student }, tenantId)`, invalidate `["lecturer-ratings-report", tenantId]`, toast success.

### 3. Out of scope
No changes to student-facing `RateLecturerDialog`, QC checks, or other exam modules.

## Technical notes
- Uses existing `PasswordConfirmDialog` for the destructive confirmation (matches project pattern).
- Query key already tenant-scoped; delete uses explicit `tenant_id` guard per multi-tenancy rules.
- Non-admin users won't see the Entries tab at all, so no accidental delete surface.