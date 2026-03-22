

## Plan: Dynamic Training Types in IssueCertificateDialog (Backward Compatible)

### The Concern
Training types like **Water Baptism**, **Holy Spirit Baptism**, and **Workers in Training (WIT)** are NOT exam courses in `exam_titles` — they are standalone training milestones that still require manual certificate issuance. Replacing the hardcoded list with only `exam_titles` would remove these options.

### Solution
Merge **three sources** into the certificate dropdown, ensuring nothing is lost:

1. **`exam_titles`** — dynamic courses from Exam Management (e.g., BCC, LCC)
2. **`app_settings` → `training_types`** — custom/admin-configured types (already fetched)
3. **Hardcoded fallback list** — kept as a safety net for Water Baptism, WIT, etc., in case they haven't been added to either of the above

### File: `src/components/certificates/IssueCertificateDialog.jsx`

1. Add a query to fetch active courses from `exam_titles`: `SELECT name FROM exam_titles WHERE is_active = true`
2. Merge all three sources with deduplication: `[...new Set([...examTitleNames, ...customTypes, ...DEFAULT_TRAINING_TYPES])]`
3. Keep `DEFAULT_TRAINING_TYPES` as a fallback — no training types are lost

This is a single-file change with no database modifications. The dropdown will automatically include any new courses created in Exam Management while preserving all existing non-exam training types.

