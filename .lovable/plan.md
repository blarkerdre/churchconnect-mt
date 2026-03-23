

## Add Training Type Dropdown to Certificate Template Settings

### Change
Replace the free-text `Input` for "Training Type" in `CertificateTemplateSettings.jsx` with a `Select` dropdown populated from the same sources used in `IssueCertificateDialog`:
- Active courses from `exam_titles` table
- Custom types from `app_settings` (key: `training_types`)
- Hardcoded defaults (BFC, BCC, LCC, LDC, Water Baptism, WIT)
- A "Default" option for the fallback template
- An "Other" option that reveals a free-text input for custom values

### File: `src/components/certificates/CertificateTemplateSettings.jsx`
1. Add imports for `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
2. Add two queries (same pattern as `IssueCertificateDialog`):
   - `exam_titles` where `is_active = true` → extract names
   - `app_settings` where `key = 'training_types'` → extract array
3. Merge all sources into `allTypes` with `Set` deduplication, prepend "Default"
4. Replace the `<Input>` for training type with a `<Select>` dropdown listing all types, plus an "Other (custom)" option
5. When "Other" is selected, show a text input for custom entry
6. Keep the field disabled when editing (as it currently is)

### No database changes needed

