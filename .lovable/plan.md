Focus the Sermon Notes expand feature on the writing area itself rather than the whole dialog. Introduce a dedicated "Focus mode" that enlarges the editor surface, increases readability, and optionally hides non-essential metadata fields while keeping the form controls accessible.

## Proposed changes

1. **Editor-focused expansion**
   - Change the expand toggle so the primary effect is on the `SermonRichEditor` writing surface, not just the outer dialog.
   - In expanded mode, increase the editor's internal padding and font size (`prose-base` or larger text) and line height for easier reading and writing.

2. **Distraction-free mode**
   - When expanded, collapse the metadata fields (Title, Speaker, Category, Folder, Service date) into a compact header/summary so the notes area occupies most of the dialog.
   - Provide a way to re-expand the metadata section if the user needs to edit it.

3. **Layout improvements**
   - Keep the dialog at a comfortable width in expanded mode (`max-w-6xl` or `max-w-7xl`) and let the notes editor consume the remaining vertical and horizontal space.
   - Ensure the editor toolbar remains sticky at the top of the writing area so formatting tools are always visible while scrolling.

4. **Accessibility & UX**
   - Use clear iconography: `Maximize2` for entering focus mode and `Minimize2` for returning to normal.
   - Add a keyboard shortcut (e.g. `Esc` to exit focus mode) and a tooltip explaining the action.
   - Preserve scroll position and editor content across expand/collapse transitions.

## Technical approach

- Update `SermonRichEditor.jsx` to accept an `expanded` prop and apply size/readability classes (padding, prose size, line height) and sticky toolbar behavior.
- Refactor `SermonNoteFormDialog.jsx` so the metadata fields can be collapsed into a summary row in expanded mode, and the notes container is the only element that grows.
- Keep the Save/Cancel footer visible at the bottom in both modes.
- No backend or data model changes required.

## Out of scope

- Adding new editor features (e.g. tables, media embeds).
- Changing the note data model or storage.
- Mobile-specific redesign beyond responsive sizing.
