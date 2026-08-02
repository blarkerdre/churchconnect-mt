## What I found

The Course Final Report looks up the logo from the certificate template using an exact match on the course name:

`certificate_templates.training_type = <course name>`

In your data those two never match for the course that has a logo:

- The saved template holding the Bible School logo is `training_type = "Basic Certificate Course (BCC)"` (it has `wofbi_logo_url` set).
- The Bible School course in the exam titles is named `"BASIC CERTIFICATE COURSE"` (code `BCC`).

Because the strings differ, no template row is found, so the WOFBI logo is never picked up. Your other courses (LCC, LDC, BFC) have template rows with no logo at all, so they can only fall back to the general church logo.

The Statement of Result uses the same exact-match lookup, so it has the same weakness.

## Fix

1. Add a shared template-resolution helper used by both the Course Final Report and the Statement of Result:
   - try exact `training_type` match (current behaviour)
   - then case-insensitive match
   - then match on the course code (e.g. `BCC`) against the code in brackets in `training_type`, or against a stored code
   - always tenant-scoped (`tenant_id` filter kept)
2. Use the resolved template's `wofbi_logo_url` → `crest_image_url` → `logo_url` → tenant logo chain as today, with the legacy private-URL signing already in `branding-url.js`.
3. In Certificate Template settings, show which Bible School course each template maps to, so a mismatch is visible; and make the report cover show a short hint when no template logo was found ("No Bible School logo saved for this course — using the church logo").

## Notes

- No database or schema change required; this is a lookup/matching fix.
- If you'd rather keep it simple, the alternative one-off fix is to rename the course to exactly `Basic Certificate Course (BCC)` (or re-upload the logo under a template named `BASIC CERTIFICATE COURSE`), but the matching fix prevents this recurring for LCC/LDC/BFC.
