## Goal
Surface the member name in the certificate report’s Activity Log view so operators can see who each certificate action relates to without cross-referencing certificate numbers.

## What to build

### 1. Client-side certificate-to-member lookup
The Activity Log fetches `audit_log` rows with `certificate_number` in `details`, but no member info. We already load all `training_completions` (with joined `members`) in the same page. Build a `Map<certificateNumber, memberName>` from the completions array so the Activity Log tab can resolve names instantly without extra queries.

### 2. Activity Log table — new "Member" column
Insert a "Member" column into the Activity Log table between "Action" and "Cert No". Use the lookup map to render the name; fall back to "—" if the certificate number isn’t found (e.g. legacy audit rows).

### 3. Activity CSV export — new "Member" column
Add a "Member" header and corresponding row value in `exportActivityCSV`, using the same lookup map.

### 4. Activity print view — new "Member" column
Add a "Member" header and row value in `buildActivityPrint`, using the same lookup map.

## Files
- `src/pages/CertificatesReport.jsx`

## No-go
- No database changes.
- No alterations to how audit logs are written.
- No changes to the By Certificate or By Programme tabs.