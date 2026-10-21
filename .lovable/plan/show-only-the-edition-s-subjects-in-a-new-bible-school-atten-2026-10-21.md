# Show only the edition's subjects in a new Bible School attendance session

Right now the Subject list in the New Attendance Session dialog shows subjects from every edition of the course at once, so names repeat (e.g. Cardiff BCC shows 14 August Edition + 14 Unassigned copies).

## What changes
- When a specific edition is selected, the Subject list shows only that edition's subjects.
- If that edition has no subjects of its own, it falls back to the Unassigned subjects.
- "Unassigned" shows only Unassigned subjects; "All editions" shows one entry per subject name (no duplicates).
- Editing an older session still shows its saved subject even if it belongs to another edition.

## Technical notes
- `src/components/exams/WoFBIAttendanceTab.jsx`: move the subjects query below `useExamSessionFilter`, select `id, name, session_id`, include `editionId` in the query key, and filter: pinned edition -> `session_id = editionId` (fallback `session_id IS NULL` when empty); unassigned -> `IS NULL`; all -> dedupe by name.
- Keep a full lookup for labels/exports (line ~731) so existing sessions still resolve their subject name.
- No database changes.
