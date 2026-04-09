

## Add Rich Text Editor to Sermon Notes

### Approach
Replace the plain `<Textarea>` in the sermon note form with **TipTap** — a modern, XSS-safe rich text editor built on ProseMirror. TipTap is headless (no XSS vulnerabilities like react-quill) and works well with React.

### Changes

#### 1. Install TipTap packages
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-placeholder`

#### 2. Create `src/components/sermons/SermonRichEditor.jsx`
A reusable rich text editor component with a simple toolbar (Bold, Italic, Underline, Bullet List, Ordered List, Heading). Uses TipTap's `useEditor` hook. Accepts `content` (HTML string) and `onChange` callback.

#### 3. Update `src/components/sermons/SermonNoteFormDialog.jsx`
- Replace `<Textarea>` with the new `SermonRichEditor`
- `content` state now stores HTML instead of plain text
- Validation strips HTML tags to check for empty content
- Widen dialog to `max-w-2xl` for better editing space

#### 4. Update `src/pages/SermonNotes.jsx`
- The note preview (line 109) currently renders `n.content` as plain text
- Render it as HTML using `dangerouslySetInnerHTML` with a sanitized snippet (strip tags for the preview card, or render a truncated HTML preview with prose styling)

### Content storage
The `content` column already stores text. It will now store HTML strings. Existing plain-text notes will render fine since plain text is valid HTML.

### Files changed
- **Install**: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-placeholder`
- **New**: `src/components/sermons/SermonRichEditor.jsx`
- `src/components/sermons/SermonNoteFormDialog.jsx` — use rich editor
- `src/pages/SermonNotes.jsx` — render HTML preview safely

