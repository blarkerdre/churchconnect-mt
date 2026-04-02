

## Fix: Remove Duplicate Church Unit Entries with Wrong Capitalisation

### Problem
Four WCI Cardiff members have duplicate church unit assignments caused by case-inconsistent entries (e.g. `Follow-Up` and `FOLLOW-UP` both assigned). The `church_unit` field stores a comma-separated string, so duplicates with different casing are treated as separate entries.

### Fix

#### 1. Database migration — clean up existing data
Run an UPDATE to normalise the `church_unit` values for the 3 affected members:

- **Favour Igbineweka** (`7aeb418e-...`): `Follow-Up, FOLLOW-UP` → `Follow-Up`
- **Loveth Osho** (`2a93a60a-...`): `Follow-Up, FOLLOW-UP` → `Follow-Up`
- **Odunsi Temitayo Ezekiel** (`fdbf7c80-...`): deduplicate to `Follow-Up, Deacon's Assembly, Fire Marshals And Warden, Technical & Media`

#### 2. Code fix — prevent future duplicates
In `MemberFormDialog.jsx`, when toggling a church unit on/off, use **case-insensitive comparison** so selecting "Follow-Up" when "FOLLOW-UP" already exists replaces it instead of adding a duplicate.

### Files changed
- Database migration (3 UPDATE statements)
- `src/components/members/MemberFormDialog.jsx` — case-insensitive unit toggle logic

