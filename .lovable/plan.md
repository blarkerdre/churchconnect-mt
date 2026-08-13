# Fullscreen Sermon Notes

## Goal
Add true fullscreen modes for both writing and reading sermon notes so the note content fills the entire browser screen.

## Proposed changes

### 1. Fullscreen editor mode
- Add a new `fullscreen` state in `SermonNoteFormDialog.jsx` alongside the existing `expanded` state.
- Add a fullscreen toggle button (e.g., `Expand` / `Shrink`) in the notes header, next to the existing Print/Expand buttons.
- When fullscreen is active:
  - Render the dialog content as a fixed overlay covering the full viewport (`fixed inset-0 z-50`, `w-screen h-screen`, no max-width/max-height limits).
  - Keep the sticky toolbar, collapsed metadata summary, and Save/Cancel footer visible.
  - Use `flex flex-col` so the editor surface grows to fill all remaining space.
- Pressing `Esc` exits fullscreen mode (and falls back to expanded/compact state).
- Restore previous expanded/compact state when exiting fullscreen.

### 2. Fullscreen reader mode
- In `SermonNotes.jsx`, add a "View full screen" option to each note's dropdown menu.
- Create a new lightweight component `SermonNoteViewer.jsx` (or inline overlay) that displays the saved note HTML, title, speaker, service date, and category in a clean, readable, full-screen overlay.
- Include a print/PDF button and a close button in the reader toolbar.
- Reuse the existing `printSermonNote` helper for branded printing.

### 3. Editor layout updates
- In `SermonRichEditor.jsx`, ensure the editor container and `EditorContent` area grow to fill the parent when `expanded` is true (or add a new `fullscreen` prop).
- Remove any remaining height caps in fullscreen mode so the writing area uses the full viewport height minus the toolbar and footer.
- Keep the toolbar sticky at the top of the editor surface.

### 4. Preserve state and data
- Entering/exiting fullscreen must not reset form values, drafts, or scroll position.
- Autosave and draft restoration continue to work in fullscreen mode.
- The existing expand/collapse mode remains available as a non-fullscreen large view.

## Outcome
Users can open the sermon note editor or any saved note in a true fullscreen view, giving the note content the maximum available screen space.

## Out of scope
- No changes to note storage, RLS, or data model.
- No new editor formatting features (tables, media, etc.).
- No mobile-specific redesign beyond responsive sizing.
