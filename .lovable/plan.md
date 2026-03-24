

## Rename "Active" to "Active Member" in All Form Dropdowns

Change the display label from "Active" to "Active Member" in all dropdown/select options across forms and filters. The underlying database value stays `"Active"` — only the visible label changes.

### Files to Change

1. **`src/components/members/MemberFormDialog.jsx`** (line 23)
   - Change `"Active"` to `"Active Member"` in the `STATUSES` array display — but keep the value as `"Active"`. Need to update the status dropdown to use separate label/value pairs, or render `"Active Member"` as label while storing `"Active"`.

2. **`src/pages/Members.jsx`** (line 161)
   - Change `<SelectItem value="Active">Active</SelectItem>` to `<SelectItem value="Active">Active Member</SelectItem>`

3. **`src/pages/PublicRegistration.jsx`** (line 17)
   - Update the STATUSES array and the dropdown rendering to show "Active Member" for the "Active" value

4. **`src/pages/MyProfile.jsx`** (line 23 and line 665)
   - Update both `MEMBERSHIP_STATUSES` arrays to display "Active Member" for "Active"

5. **`src/components/members/BulkImportDialog.jsx`** (line 16)
   - Update `VALID_STATUSES` display — the CSV import should accept both "Active" and "Active Member"

### Approach
Since the DB stores `"Active"`, each dropdown will use `value="Active"` but display `"Active Member"` as the label. For arrays used to generate `<option>`/`<SelectItem>` elements, we'll use a mapping: render the label as `s === "Active" ? "Active Member" : s` while keeping the value as-is.

### What stays unchanged
- Database values remain `"Active"`
- Badge displays, analytics, stats cards — kept as-is (or can be updated if desired)
- Summary card labels like "Active" count

