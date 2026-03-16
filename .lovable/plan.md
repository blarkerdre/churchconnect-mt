

## Plan: Fix Confirmation Emails + Add Document Upload/Download to Reports

### Issue 1: Confirmation Emails Not Being Received

Currently, no email domain is configured for this project. Without an email domain, authentication emails (sign-up verification, password reset) use the default system emails which may land in spam or not arrive at all.

**Solution:** Set up a custom email domain so that branded, reliable confirmation emails are sent. This requires:
1. Configure an email domain via the email setup dialog
2. Scaffold auth email templates
3. Deploy the auth-email-hook edge function

### Issue 2: Document Upload/Download for All Units (Reports)

The request is to allow unit leaders, admins, and super admins to upload and download documents/files when submitting reports. This should be available across all unit report pages (Training Reports, Church Attendance, etc.).

**Database changes:**
- Create a `documents` table: `id`, `file_name`, `file_path`, `file_size`, `mime_type`, `description`, `uploaded_by` (uuid), `related_table` (text, e.g. "training_reports"), `related_id` (uuid), `created_at`
- Create a `church-documents` storage bucket (private)
- RLS on `documents`: admins and unit leaders can INSERT, SELECT, DELETE
- Storage policies: admins and unit leaders can upload/download/delete in `church-documents` bucket

**Frontend changes:**
- Create a reusable `ReportAttachments` component that can be embedded in any report form/detail view
  - File upload with drag-and-drop or file picker
  - List of attached files with download and delete buttons
  - Max 10MB per file client-side validation
- Integrate `ReportAttachments` into:
  - `TrainingReports.jsx` — attach files to training report entries
  - `ChurchAttendance.jsx` — attach files to church attendance reports
- Use `supabase.storage.from('church-documents').upload()` for uploads
- Use `supabase.storage.from('church-documents').createSignedUrl()` for downloads

**Navigation:** No new page needed — documents attach directly to reports inline.

### Technical Details

**Migration SQL (documents table + storage bucket):**
```sql
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  description text,
  uploaded_by uuid,
  related_table text,
  related_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/leaders can manage documents" ON public.documents
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Admins/leaders can view documents" ON public.documents
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('church-documents', 'church-documents', false);

CREATE POLICY "Admins/leaders can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'church-documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)));

CREATE POLICY "Admins/leaders can read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'church-documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)));

CREATE POLICY "Admins/leaders can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'church-documents' AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role)));
```

**New component:** `src/components/reports/ReportAttachments.jsx` — reusable file upload/download widget accepting `relatedTable` and `relatedId` props.

### Email Setup Step

Before implementing code changes, the email domain needs to be configured first:

<lov-actions>
<lov-open-email-setup>Set up email domain</lov-open-email-setup>
</lov-actions>

