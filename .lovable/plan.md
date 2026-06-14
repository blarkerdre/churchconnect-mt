## Goal
Let admins/Training Reps preview the rendered certificate image before committing to Issue or Reissue, so they can catch wrong dates, names, training types, or template/background issues without generating a real certificate number, storing a file, or sending the email.

## Changes

### 1. Edge function — `supabase/functions/issue-certificate/index.ts`
Add a `preview: true` mode to the existing function (keeps auth + template logic identical, no duplication).

When `preview` is true:
- Run the same auth + role checks (admin or Training Rep unit_leader).
- Resolve the member and template exactly as today.
- For a **new** preview: use the posted `training_type` / `completion_date`; use a placeholder certificate number `PREVIEW-XXXX-XXXX-XXXX` (not persisted, no DB count query).
- For a **reissue** preview (`completion_id` provided): load the existing row and use its real `certificate_number` and `completion_date`.
- Render the SVG → PNG using the existing `renderSvgToPng` path.
- Skip: `training_completions` insert/update, storage upload, signed-URL creation, email send, audit log.
- Return `{ preview: true, image_base64, content_type: "image/png", certificate_number, training_type, completion_date, member_name }`.

No schema changes.

### 2. Dialog — `src/components/certificates/IssueCertificateDialog.jsx`
- Add a `previewMutation` that calls `supabase.functions.invoke("issue-certificate", { body: { ..., preview: true } })` and stores the returned base64 PNG in local state (`previewImage`, `previewMeta`).
- Add a **Preview** button:
  - In the footer next to "Issue Certificate" (disabled until `trainingType` is selected) — previews the new certificate using current form values.
  - On each existing completion row, next to Download/Reissue (eye icon) — previews the saved certificate using its `completion_id`.
- Add a `CertificatePreviewDialog` (sibling component in same file or `CertificatePreviewDialog.jsx`) that opens on top of the issue dialog and shows:
  - The PNG (`<img src={"data:image/png;base64," + previewImage} />`) at full width with rounded corners.
  - Meta line: member name · training type · completion date · certificate number (or "Preview" badge for unissued).
  - Footer: "Close" + (when previewing a new cert) "Issue Certificate" shortcut that closes the preview and triggers the existing `issueMutation`; (when previewing an existing cert) "Reissue" shortcut that triggers `reissueMutation`.
- Loading state: show spinner inside the Preview button while `previewMutation.isPending`.

### Out of scope
- No changes to `CertificateTemplateSettings` (it already has its own template preview).
- No changes to `MyCertificates` (members already see issued certs).
- No new tables, RLS, or storage objects.

## Technical notes
- Returning base64 keeps the function stateless and avoids creating throwaway storage objects per preview click; 595×842 PNGs are well under the 6 MB function response limit.
- The placeholder `certificate_number` for unissued previews is clearly marked (`PREVIEW-…`) so it can never be confused with a real one, and the count-query is skipped to keep previews cheap.
- Reissue preview shows exactly what the regenerated file will look like (same template, same cert number) before overwriting the stored PNG and re-emailing.
