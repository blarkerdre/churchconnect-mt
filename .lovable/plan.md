

## Add "House Provider" field to WSF Centres

The WSF centres table currently lacks a `host_name` column. The `WSFCentreFormDialog` references it but the settings section (`WSFCentresSection.jsx`) does not include it.

### Changes

1. **Database migration** — Add `host_name TEXT` column to `wsf_centres`.

2. **Update `WSFCentresSection.jsx`**:
   - Add `host_name` to the form state, edit prefill, and save payload.
   - Add a "House Provider" input field in the dialog form.
   - Display the house provider name on the centre card when present.

3. **Update `WSFCentreFormDialog.jsx`** — Rename the label from "Host Name" to "House Provider" for consistency.

### Technical detail
- Migration: `ALTER TABLE public.wsf_centres ADD COLUMN host_name TEXT;`
- The field is optional (nullable), no RLS changes needed since existing policies cover the table.

