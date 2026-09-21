# Add uploaded signatures to certificate templates

## What will change

- Add a **Signature Image** control to each certificate template, beside the existing signatory name and title.
- Allow authorised admins to upload a PNG, JPG, or WEBP signature image, with file-type and size validation.
- Store the image privately under the current church and save its path on that template.
- Show the saved signature in the template editor, with an option to remove or replace it.
- Include the signature in the template preview so placement can be checked before saving.
- Render the signature above the signatory name/title on both Bible School and other generated certificates.
- Ensure new certificates, previews, reissues, downloads, and emailed certificates all use the selected template signature.

## Safety and access

- Keep signatures in the existing private document storage rather than exposing a public image URL.
- Preserve church isolation in every upload, template update, and image lookup.
- Keep the current certificate issuing permissions unchanged.
- Validate uploads before storage and show clear errors for unsupported or oversized images.

## Technical details

- Reuse the existing nullable `certificate_templates.dean_signature_url` field; no database schema change is required.
- Extend the certificate template form state, edit hydration, and save payload with the signature path.
- Resolve a short-lived signed preview URL in the editor.
- Extend the server-side SVG renderer so the signature image appears consistently in Bible School, custom-background, and standard certificate layouts.
- Retain the existing signatory name/title fallback when no signature image is uploaded.

## Verification

- Test upload, preview, replace, remove, save, and reopen on a template.
- Preview and issue one Bible School certificate and one standard certificate.
- Confirm the signature appears in saved downloads and reissued certificates without exposing the private storage path.
- Check the editor at desktop and mobile widths.
