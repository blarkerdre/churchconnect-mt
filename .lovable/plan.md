

## Plan: Training Completion Certificates

### Overview
Add a system where admins/leaders can mark individual members as having completed a training programme, which generates a PDF certificate, emails it to the member, and makes it downloadable from the member's profile.

### Database Changes

**1. New table: `training_completions`**
- `id` (uuid, PK)
- `member_id` (uuid, FK to members)
- `training_type` (text) — e.g. "BFC", "Water Baptism"
- `completion_date` (date)
- `certificate_number` (text, unique) — auto-generated e.g. "CERT-BFC-2026-0001"
- `certificate_url` (text, nullable) — path in storage bucket
- `issued_by` (uuid) — the admin/leader who marked completion
- `notes` (text, nullable)
- `created_at` (timestamptz)
- RLS: admins/leaders can INSERT/SELECT/UPDATE; members can SELECT own records (via member_id → user_id join)

**2. New table: `certificate_templates`**
- `id` (uuid, PK)
- `training_type` (text, unique)
- `church_name` (text, default "Winners Chapel International Cardiff")
- `signatory_name` (text) — e.g. pastor's name
- `signatory_title` (text) — e.g. "Senior Pastor"
- `logo_url` (text, nullable)
- `background_color` (text, default "#1a2d4d")
- `accent_color` (text, default "#c5a028")
- `custom_message` (text, nullable) — e.g. "This is to certify that..."
- `created_at`, `updated_at`
- RLS: admins can manage; authenticated can view

### Edge Function: `issue-certificate`

**Trigger**: Called from frontend when admin clicks "Issue Certificate" for a member + training type.

**Logic**:
1. Verify caller is admin/unit_leader
2. Check for duplicate (member + training_type already completed)
3. Generate a unique certificate number
4. Generate PDF certificate using the template settings from `certificate_templates` (fallback to defaults)
5. Upload PDF to `church-documents` storage bucket under `certificates/` path
6. Insert record into `training_completions` with the certificate URL
7. Email the PDF certificate to the member (using the existing email queue infrastructure)
8. Return success with certificate URL

**PDF Content**: Member name, training programme, completion date, certificate number, church branding, signatory — all configurable via `certificate_templates`.

### Frontend Changes

**1. Members page — "Issue Certificate" action**
- In `MemberFormDialog.jsx` or `MemberTable.jsx`, add an "Issue Certificate" button/dialog
- Dialog: select training type, completion date, optional notes → calls the edge function
- Shows existing completions for that member

**2. Settings page — Certificate Templates tab**
- New section under Settings to manage certificate templates per training type
- Configure church name, signatory, colors, custom message

**3. My Profile page — Certificates section**
- New card below "Growth Milestones" showing the member's earned certificates
- Each certificate has a download button that fetches a signed URL from storage

**4. Training Reports page — Bulk issue option** (future enhancement, not in v1)

### Files to create/modify
- **New migration**: `training_completions` and `certificate_templates` tables
- **New edge function**: `supabase/functions/issue-certificate/index.ts`
- **New component**: `src/components/certificates/IssueCertificateDialog.jsx`
- **New component**: `src/components/certificates/CertificateTemplateSettings.jsx`
- **Modified**: `src/pages/MyProfile.jsx` — add Certificates card
- **Modified**: `src/pages/Settings.jsx` — add Certificate Templates tab
- **Modified**: `src/components/members/MemberFormDialog.jsx` or `MemberTable.jsx` — add issue certificate action
- **Modified**: `supabase/config.toml` — add `[functions.issue-certificate]` with `verify_jwt = false`

### Technical Notes
- PDF generation in the edge function will use a lightweight HTML-to-PDF approach or a canvas-based approach compatible with Deno
- Certificates stored in the existing `church-documents` bucket under `certificates/{member_id}/`
- Email delivery uses the existing pgmq transactional email queue
- Also updates the member's boolean fields (e.g. `bfc_completed = true`) when applicable

