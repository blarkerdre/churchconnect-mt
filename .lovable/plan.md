## Change

In `src/components/exams/QcCheckDialog.jsx`, auto-populate the **QC Team Member** field with the currently signed-in user when creating a new QC check.

### How
- Add a query to fetch the signed-in user's member record for this tenant (`members` where `user_id = auth user id` and `tenant_id`), selecting `id, first_name, last_name, church_unit`.
- In the existing `useEffect` that resets the form on open (new record path, not edit), if the signed-in member exists and their `church_unit` includes "Training Rep", pre-fill `qc_member_id` and `qc_member_name` from that record.
- Keep the dropdown editable so the user can change it if needed (e.g. an admin filling on behalf of someone).
- Edit mode is unchanged — it keeps hydrating from `editRecord`.
- If the signed-in user is not a Training Rep member (e.g. admin), leave the field empty as today.

### Out of scope
- No DB changes, no RLS changes, no changes to the Training Rep dropdown source list.

### Files touched
- `src/components/exams/QcCheckDialog.jsx`
