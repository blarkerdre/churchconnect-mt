

## Add Color, Text Alignment, and Scrollable Content to Sermon Notes

### Changes

#### 1. Install TipTap extensions
- `@tiptap/extension-color` — text color support
- `@tiptap/extension-text-style` — required dependency for color
- `@tiptap/extension-text-align` — paragraph alignment (left, center, right, justify)

#### 2. Update `src/components/sermons/SermonRichEditor.jsx`
- Register `TextStyle`, `Color`, and `TextAlign` extensions in the editor
- Add a color picker input (HTML `<input type="color">`) to the toolbar
- Add alignment buttons (AlignLeft, AlignCenter, AlignRight, AlignJustify icons from lucide-react)
- Make the editor content area scrollable: change `min-h-[200px]` to `max-h-[400px] overflow-y-auto` so long notes scroll within the editor

#### 3. Update `src/pages/SermonNotes.jsx`
- Make the note preview content on cards scrollable by adding `max-h-[80px] overflow-y-auto` to the content preview paragraph (the `line-clamp-3` area)

#### 4. Update `src/components/sermons/SermonNoteFormDialog.jsx`
- Add `max-h-[60vh] overflow-y-auto` to the dialog body so the entire form scrolls on smaller screens

### Files changed
- **Install**: `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-text-align`
- **Edit**: `src/components/sermons/SermonRichEditor.jsx` — add color picker, alignment buttons, scrollable editor
- **Edit**: `src/pages/SermonNotes.jsx` — scrollable card previews
- **Edit**: `src/components/sermons/SermonNoteFormDialog.jsx` — scrollable dialog body

