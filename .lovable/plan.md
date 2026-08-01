# Country dropdown for Nationality

Replace the free-text Nationality inputs with a searchable dropdown of countries (nationality/demonym labels), so entries are consistent across the app.

## What changes

1. **New shared list** — `src/lib/countries.js` exporting a full ISO-3166 list of countries with their nationality/demonym (e.g. `United Kingdom → British`, `Nigeria → Nigerian`). Stored value = the demonym string, so existing data stays compatible.

2. **New shared component** — `src/components/shared/NationalitySelect.jsx`: a shadcn Popover + Command combobox with type-to-search, keyboard support, mobile-friendly width, and a "Clear" option. Value in/out is a plain string.

3. **Use it everywhere Nationality is captured**
   - `src/pages/PublicRegistration.jsx` (public/QR registration)
   - `src/components/members/MemberFormDialog.jsx` (admin add/edit member)
   - `src/pages/MyProfile.jsx` (member self-service)

4. **Legacy values** — if a stored nationality isn't in the list (old free-text entries), it still displays as the selected value rather than showing blank.

## Not changing

- Database columns, RPC signatures, and the `public-register` edge function stay as-is (still a text field).
- CSV export unchanged. Bulk import stays free-text but is trimmed as today.

## Technical notes

- Uses existing shadcn `Popover` + `Command` primitives already in the project; no new dependencies.
- Dropdown is rendered with mobile-safe width (`w-[calc(100vw-2rem)] sm:w-[320px]`) and a scrollable list, consistent with the app's responsive patterns.
