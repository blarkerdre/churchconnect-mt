

## Plan: Bulk CSV Import for Member Updates

### Overview
Add a CSV import feature to the Members page that lets admins upload a spreadsheet to create new members or update existing ones in bulk. Matching is done by email address — if a member with that email exists, their record is updated; otherwise, a new member is created.

### User Flow
1. Admin clicks "Import CSV" button (next to existing CSV export button)
2. A dialog opens with instructions and a file picker
3. Admin uploads a CSV file
4. The system parses the CSV, shows a preview table with row count and any validation errors
5. Admin confirms the import
6. Records are upserted (matched by email) and results are displayed (created / updated / skipped counts)

### Technical Details

**New component: `src/components/members/BulkImportDialog.jsx`**
- File input accepting `.csv` files
- Client-side CSV parsing (no external library needed — use native `FileReader` + split logic)
- Expected columns (case-insensitive matching): `first_name`, `last_name`, `email`, `phone`, `gender`, `membership_status`, `church_unit`, `address`, `city`, `postcode`, `date_of_birth`, `emergency_contact_name`, `emergency_contact_phone`
- Validation: require `first_name` and `last_name` per row; normalize phone numbers using existing `normalizePhone` utility
- Preview table showing first 5 rows + total count
- Error summary for invalid rows (missing required fields, invalid status values, etc.)

**Import logic:**
- For each valid row, check if a member with that email already exists (via a single query fetching all members by the CSV emails)
- Existing members: update via `supabase.from("members").update(...)` 
- New members: insert via `supabase.from("members").insert(...)`
- Process in batches to avoid timeouts
- Show toast with results: "X created, Y updated, Z skipped"

**Edit to `src/pages/Members.jsx`:**
- Add "Import CSV" button next to existing "CSV" export button (admin only)
- Add state + render for `BulkImportDialog`

### Files
- **New**: `src/components/members/BulkImportDialog.jsx`
- **Edit**: `src/pages/Members.jsx` — add import button and dialog

No database changes needed — uses existing `members` table and admin RLS policies.

