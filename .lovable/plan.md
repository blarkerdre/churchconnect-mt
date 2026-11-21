# Fix "Import failed" on Manage Contacts CSV upload

## What's wrong
The importer asks the database to "skip if this email already exists" using a rule the database doesn't have in that exact form. The email check only covers rows that have an email and ignores capital letters, so the database rejects the whole upload.

## Fix
- Save new contacts as normal inserts instead of "insert or skip". The app already removes duplicates before saving (same email or same phone, both against existing contacts and within the file).
- Save in groups of 200 so large lists work.
- If one group hits a duplicate email someone added at the same moment, retry that group one contact at a time and count the duplicates as skipped. One bad row will no longer stop the whole import.
- Keep the success message: "X imported, Y duplicates skipped".

## Check
- Import your RCCG file (177 contacts) into Demo Church (TEST) and confirm all 177 appear with +1 numbers. Then remove the test contacts.
- Re-import the same file and confirm the message says "Nothing imported: all duplicates".

## Technical details
- `ContactsManager.jsx` `importCsv`: replace `upsert(..., { onConflict: "tenant_id,email" })` with chunked `insert`. On error `23505`, fall back to inserting rows one at a time and skip any that fail.
- The cause is the partial expression index `idx_contacts_tenant_email (tenant_id, lower(email)) WHERE email IS NOT NULL`, which PostgREST `on_conflict` can't target. No schema change is needed.
