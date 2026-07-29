## Goal
Define clear age bands for the three groups, show them as notes in My Family and Children Church, and make promotion follow a strict ladder: Early Years → Preteens → Teens.

## Age bands
- Early Years: 2-4 years old, 5-7 years old, 8-9 years old
- Preteens: 10-12 years old
- Teenagers: 13-17 years old

## Changes

### 1. Age group options (Early Years)
- Replace the default list `["Nursery","Toddler","Primary","Pre-Teen"]` with `["2-4 years old","5-7 years old","8-9 years old"]` in `src/pages/MyFamily.jsx` and `src/pages/ChildrenChurch.jsx`.
- Tenants that already customised their age groups in Settings keep their own saved list (the setting still overrides the default). Existing child records keep whatever value they were saved with; the report filter continues to build from the same list.

### 2. Guidance notes
- My Family: short muted note under the "Early Years" heading ("Ages 2-9: 2-4, 5-7 and 8-9 years old"), under the Preteens heading ("Ages 10-12"), and under the Teenagers heading ("Ages 13-17"). Preteens/Teens notes go in `PreteensSection.jsx` / `TeensSection.jsx`.
- Children Church: same one-line note under the Early Years / Preteens / Teens tab content headers, plus under the age-group selector in the registration form.

### 3. Promotion ladder
- My Family, Early Years card: replace "Promote to teenager" with "Promote to preteen" — creates a `preteens` record (carrying name, DOB, gender, notes and consent flags), then deletes the child record if it has no check-in history, otherwise archives it (same safeguards as today: blocked while the child is in care).
- Preteens card: add "Promote to teen" — creates a `teens` record from the preteen (same field/consent carry-over), then removes the preteen record; blocked if the preteen has an open check-in.
- Both actions use a confirmation dialog and refresh the relevant lists.

## Technical notes
- Promotion is client-side, mirroring the existing `promoteToTeen` mutation pattern in `MyFamily.jsx`, with explicit `.eq("tenant_id", tenantId)` guards on every read/write.
- No database migration required — `preteens` and `teens` tables and their consent columns already exist.
- No changes to table names, RLS, routes, query keys or `data-tour` attributes.
