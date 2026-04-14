

## Data Cleanup: Deduplicate Church Unit Assignments

### Problem
Several members have duplicate church units in their `church_unit` field caused by inconsistent casing (e.g. `Follow-Up` and `FOLLOW-UP` treated as separate entries). Three members are affected:

| Member | Current Value | Cleaned Value |
|--------|--------------|---------------|
| Loveth Osho | `Follow-Up, FOLLOW-UP` | `Follow-Up` |
| Favour Igbineweka | `Follow-Up, FOLLOW-UP, Kingdom Care Covenant` | `Follow-Up, Kingdom Care Covenant` |
| Odunsi Temitayo Ezekiel | `Follow-Up, DEACON'S ASSEMBLY, FIRE MARSHALS AND WARDEN, TECHNICAL & MEDIA, FOLLOW-UP, Deacon's Assembly, Technical & Media` | `Follow-Up, Deacon's Assembly, Fire Marshals and Warden, Technical & Media` |

### Implementation

1. **Run three UPDATE statements** via the data insert tool to fix each member's `church_unit` value, deduplicating and normalizing casing to match the canonical unit names.

2. **Add frontend validation** in `MemberFormDialog.jsx` to prevent duplicate units from being saved in the future — deduplicate (case-insensitive) when joining selected units back into the comma-separated string.

### Technical Details
- Use the database insert tool (not a migration) since this is a data update
- The canonical casing will match what exists in the `church_units` table
- The form-level dedup will normalize on save: convert to a Set using lowercase keys, keeping the first-seen casing

