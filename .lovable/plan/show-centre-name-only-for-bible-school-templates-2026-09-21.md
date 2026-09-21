# Show Centre Name only for Bible School templates

Same rule as the logo: the Centre Name field only makes sense on Bible School (Statement of Result) templates, so it should hide for other certificate types.

## Changes

In `src/components/certificates/CertificateTemplateSettings.jsx`:

1. Wrap the **Centre Name** field in the existing `isBibleSchoolTemplate` check, so it appears only for Bible School certificate types — exactly like the Bible School Logo field.
2. Rename the label to **Bible School Centre Name (Statement of Result)** to match the logo wording.
3. Saved centre names stay untouched — editing a non-Bible School template keeps its stored value; nothing is cleared.

## Technical details

- `isBibleSchoolTemplate` (line 62) already computes whether the selected training type matches an active Bible School course; the Centre Name block (lines 496–504) moves inside that conditional, mirroring the logo block (lines 505–523).
- No database change — reuses the existing `centre_name` column.
- Verify in the editor: Bible School type shows Centre Name + Bible School Logo; any other type shows neither.
