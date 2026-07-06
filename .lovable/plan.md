Use the uploaded certificate image (`IMG-20260610-WA0020.jpg`) as a reusable, editable Bible School certificate template.

Background
- The uploaded image is a physical certificate from The Word of Faith Bible Institute, Cardiff (Basic Certificate Course).
- The app already has a dedicated Bible School certificate SVG layout with matching fonts (Great Vibes, Pinyon Script, Playfair Display).
- Currently, that layout only renders on a plain white background; if a custom background image is uploaded, the app falls back to a generic overlay that does not use the Bible School styling.

Plan
1. Clean the certificate image
   - Use AI image editing to remove the personalized text: student name, student number, grade/classification ("Distinction"), and the specific date.
   - Preserve the header, borders, institute logo/crest, signature line, and decorative elements.
   - Result: a blank certificate background that can be reused for any student.

2. Store the background
   - Upload the cleaned image to Supabase storage in the `church-documents` bucket under the tenant's `certificate-backgrounds` path.
   - Also save a local asset reference for fallback/preview use.

3. Extend the certificate generation to support Bible School + background image
   - Modify the `issue-certificate` Edge Function so the Bible School SVG branch can render on top of a custom background image (currently it is skipped when a background image exists).
   - The dynamic text fields (name, student number, course name, grade, date, signatory) will overlay the background in the existing Bible School fonts and positions.

4. Update the template settings UI
   - `CertificateTemplateSettings.jsx` already supports `background_image_url` but the Bible School layout ignores it.
   - Ensure the template preview SVG correctly renders the background image with the Bible School text overlay so admins can adjust positions visually.
   - Expose the `dean_signature_url` and `crest_image_url` fields (already in the DB schema) in the template editor so admins can configure signatures and logos per template.

5. Create the Bible School template record
   - Create a `certificate_templates` row for the training type "Basic Certificate Course" (or the matching Bible School exam title) using the cleaned background image.
   - Set sensible default text positions that align with the blank areas of the cleaned certificate image.

6. Verify end-to-end
   - Trigger a preview certificate issue for a Bible School course and confirm the generated PNG correctly overlays dynamic text onto the uploaded certificate background.

Files touched
- `supabase/functions/issue-certificate/index.ts`
- `src/components/certificates/CertificateTemplateSettings.jsx`
- Storage: `church-documents` bucket (tenant certificate-backgrounds path)
- DB: `certificate_templates` table (new row + possible position adjustments)