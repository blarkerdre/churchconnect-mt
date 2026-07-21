## Fix: historic Bible School application answers show as empty

### Root cause
The Applications detail dialog (`src/components/exams/WoFBIApplicationsTab.jsx`, ~line 830) renders answers by iterating the **current** `wofbi_application_forms.fields` and looking up `detail.answers[f.id]`. When the form is toggled off, reset, or its fields are edited, that list no longer matches the field IDs stored in historic rows, so every value renders as `—` even though the data is intact in `wofbi_applications.answers`.

### Change
Make the detail dialog render answers from the stored row itself, falling back to the current form config for labels:

1. Build the field list as a **union** of:
   - The current `form.fields` (preferred — gives labels, ordering, and section headings), plus
   - Any keys present in `detail.answers` that aren't in the current config, appended at the end with a humanised label derived from the key (e.g. `home_address` → "Home Address"). These render as plain rows (no section heading logic).
2. Only skip a row if the value is `undefined`/`null`/empty string **and** the field isn't in the current config — so admins still see previously-captured data even after they toggle the form off or remove/rename fields.
3. Keep the existing "direct source has no answers" branch unchanged.
4. Leave the public registration submission behaviour untouched (short form still submits `answers: {}` when toggled off — that matches the current product intent).

### Technical notes
- Purely a frontend/presentation change in `WoFBIApplicationsTab.jsx`. No schema, RLS, or edge function changes.
- The `answerFields` memo (line 298) used for column filters can stay as-is since it correctly represents "fields currently configured"; it doesn't drive the detail dialog.
- Humanised label helper: split on `_`, title-case each word, keep it local to the file.

### Verification
- Open an application row that was submitted before the form was toggled off/edited: the detail dialog now shows the stored answers with sensible labels.
- Open a row submitted while toggled off (short form): dialog shows the "no detailed answers captured" state as today (answers object is `{}`).
- Direct-source rows still show the existing "created directly as a course registration" message.
