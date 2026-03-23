

## Add Certificate Template Preview

### Overview
Add a "Preview" button to the certificate template form that renders a live SVG preview of the certificate using the current form values, with sample placeholder data. This lets admins see exactly how the certificate will look before saving.

### Changes

**File: `src/components/certificates/CertificateTemplateSettings.jsx`**

1. Add an `Eye` icon import from lucide-react
2. Add a `previewOpen` state for a second dialog
3. Create a `generatePreviewSvg()` function that replicates the same SVG logic from the edge function:
   - When `background_image_url` is set: uses the signed `previewUrl` as the background image, overlays text at configured `text_positions`
   - When no background image: renders the full default SVG design with colors, borders, church name, custom message
   - Uses placeholder data: name = "John Doe", certificate number = "CERT-XXXX-2026-0001", date = today
4. Add a "Preview Certificate" button next to the Save button in the form dialog
5. Add a preview Dialog that renders the SVG inline using `dangerouslySetInnerHTML` inside a scaled container (landscape 842x595 scaled to fit dialog width)

### Technical Detail
- The SVG generation mirrors the edge function logic exactly (both background-image and default-design branches)
- For background images, uses the already-resolved `previewUrl` signed URL directly in the `<image>` href (no base64 needed for browser rendering)
- Preview updates live as the admin changes colors, positions, signatory, etc.
- No database or edge function changes needed — purely client-side

