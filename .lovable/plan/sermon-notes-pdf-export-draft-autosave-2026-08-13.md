# Sermon Notes: PDF export + draft autosave

## 1. Export / print to PDF

Add a **Print / PDF** button to the Sermon Notes dialog header (next to Expand/Collapse), available in both normal and expanded layouts, and a matching "Print / PDF" item on each note's row menu in the notes list.

Printing opens a hidden iframe containing a clean, print-styled document (same technique already used for Bible School reports), then triggers the browser print dialog where the user can choose "Save as PDF".

Printed page contains:
- Church logo and name header (tenant branding), matching other printed documents.
- Title, speaker, category, folder, service date.
- Full note body with formatting preserved (headings, bold, lists, Bible references rendered as plain text with reference, no interactive tooltips).
- Footer with printed-on date and page numbers.

Rules:
- Print uses the current unsaved editor content when launched from the dialog, so what you see is what prints.
- Bible reference links print as normal text (no underline/blue) so the page reads cleanly.

## 2. Autosave drafts and restore

Autosave the note being edited so nothing is lost on refresh, accidental close, or navigating away.

- Drafts are saved locally in the browser, keyed per user and per note (new notes get their own "new note" draft key per folder).
- Saving happens automatically about 1.5 seconds after typing stops, plus on dialog close and page unload.
- A small status line under the editor shows "Saving…" / "Draft saved HH:MM".
- When reopening the dialog (or after a refresh) and a newer local draft exists than the stored note, a bar appears at the top: *"Unsaved draft from <time> found"* with **Restore draft** and **Discard** buttons. Nothing is silently overwritten.
- On a successful Save, the draft for that note is cleared.
- Drafts older than 30 days are pruned automatically.

## Technical notes

- New `src/lib/sermon-note-print.js`: builds the print HTML (escaped metadata, sanitized note HTML), injects a hidden iframe, calls `print()`, removes the iframe afterwards. Reuses existing logo/branding resolution helpers (`branding-url.js`, `logo-data-url.js`).
- New `src/hooks/useSermonNoteDraft.js`: debounced `localStorage` read/write with keys `sermon-draft:{userId}:{noteId|new}`, storing `{ title, speaker, category, serviceDate, folderId, content, updatedAt }`, plus a prune-on-load routine.
- `SermonNoteFormDialog.jsx`: wire the hook to existing state, add the restore bar, draft status text, and the Print button; clear the draft in `handleSave`.
- `SermonNotes.jsx`: add "Print / PDF" to the per-note actions menu.
- No database or RLS changes; drafts stay on-device and private.
