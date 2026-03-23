

## Upload Sample Certificate as Background Template

### Overview
Allow admins to upload a certificate image (PNG/JPG/PDF) per template, which becomes the background of generated certificates. The member name, training type, date, and certificate number are overlaid on top of the uploaded design.

### Changes

**1. Template Settings UI — `src/components/certificates/CertificateTemplateSettings.jsx`**
- Add an image upload field in the template form dialog
- Upload to `church-documents` bucket under `certificate-backgrounds/{template_id}.png`
- Store the file path in the existing `logo_url` column on `certificate_templates` (repurposed as `background_image_url`)
- Show a thumbnail preview of the uploaded image in the template list and form

**2. Database — rename/add column**
- Add a `background_image_url` column to `certificate_templates` (text, nullable) to store the storage path of the uploaded sample image
- Keep `logo_url` for future logo use

**3. Edge function — `supabase/functions/issue-certificate/index.ts`**
- When `background_image_url` is set on the matched template:
  - Generate a signed URL for the background image
  - Embed it as an `<image>` element in the SVG (full 842x595 background)
  - Overlay only the dynamic text (member name, training type, date, certificate number, signatory) on top
- When no background image is set, use the current SVG-generated design as fallback

**4. Template form — text position controls (optional but recommended)**
- Add fields for vertical position offsets (name Y, training Y, date Y) so admins can align text to their uploaded design
- Store as JSON in a new `text_positions` column or as individual columns
- Default positions match current SVG layout

### Technical Detail

```text
Certificate rendering priority:
1. Template has background_image_url → use uploaded image as background, overlay text
2. Template exists but no image → use current SVG-generated design with colors
3. No template → use defaults
```

SVG with background image:
```xml
<svg width="842" height="595">
  <image href="{signed_url}" width="842" height="595"/>
  <text x="421" y="280" ...>{Member Name}</text>
  <!-- other dynamic text -->
</svg>
```

### Files to change
- Migration: add `background_image_url` and `text_positions` columns to `certificate_templates`
- `src/components/certificates/CertificateTemplateSettings.jsx` — add image upload/preview
- `supabase/functions/issue-certificate/index.ts` — support background image in SVG generation

