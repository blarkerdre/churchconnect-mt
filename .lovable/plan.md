# Bible Book Autocomplete in Sermon Editor

Add an inline autocomplete dropdown that suggests Bible book names as the user types in the sermon rich text editor. Selecting a suggestion inserts the canonical book name (e.g. typing "mat" → picks "Matthew"), letting the existing `BibleRef` input rule then convert `Matthew 6:33` into a hoverable verse link.

## User experience

- While typing a word (≥2 letters) that matches the start of a Bible book name or a known alias, a small popover appears just below the caret listing up to 6 matches.
- Arrow Up/Down highlight, Enter or Tab inserts the canonical book name plus a trailing space, Esc closes the menu.
- Clicking a suggestion inserts the same way.
- Matching is case-insensitive and includes aliases already defined in `src/lib/bible/refs.js` (so "mathew", "phil", "1cor", "song" all surface the right canonical name).
- Numbered books work: typing `1 co`, `1co`, or `i co` all surface `1 Corinthians`.
- The menu only opens at the start of a word (previous char is whitespace or start of node) so it doesn't fire mid-word inside unrelated text.
- After insertion, if the user continues with a space + chapter/verse (e.g. `Matthew 6:33`), the existing `BibleRef` InputRule automatically upgrades it to a hover-enabled reference — no separate work needed.

## Implementation

Files to add:

- `src/components/sermons/extensions/BibleBookSuggestion.js` — Tiptap `Extension` built on `@tiptap/suggestion`.
  - `char: ""` with a custom `findSuggestionMatch` that scans the word immediately before the caret using a regex like `/(?:^|\s)((?:[1-3]|I{1,3})?\s?[A-Za-z]{2,})$/`.
  - `items({ query })`: matches against a flat list derived from `BOOKS` in `refs.js` — canonical name + all aliases — returning up to 6 unique canonical names sorted by (startsWith > includes) then alphabetical.
  - `command`: replaces the matched range with `"{canonicalName} "`.
  - `render`: uses `tippy.js` (already transitively available via Tiptap, otherwise a lightweight absolute-positioned React portal — see fallback below) to mount a React component.

- `src/components/sermons/BibleBookSuggestionList.jsx` — the popover UI.
  - Small card styled with existing Tailwind tokens (`bg-popover text-popover-foreground border border-border rounded-md shadow-md`).
  - Keyboard handling via `forwardRef` + `useImperativeHandle` exposing `onKeyDown` (standard Tiptap suggestion pattern).

Files to modify:

- `src/lib/bible/refs.js` — export a helper `getBookSuggestions(query, limit = 6)` that reuses the existing `BOOKS`/alias data (no duplication).
- `src/components/sermons/SermonRichEditor.jsx` — add the new extension to the `extensions` array right after `BibleRef`.

## Technical details

- Popover positioning: if `tippy.js` isn't already bundled, use a portal + `getBoundingClientRect()` of the current selection (via `editor.view.coordsAtPos(editor.state.selection.from)`) and position with `fixed` styles — no new dependency.
- Do not add any new npm packages; `@tiptap/suggestion` ships with the core Tiptap install already used for `StarterKit`. If it's not present, fall back to a manual `ProseMirror` plugin (`new Plugin({ props: { handleKeyDown, decorations } })` from `prosemirror-state`, which is a transitive dep of Tiptap) — same UX, no new deps.
- Excluded contexts: don't open inside a `bibleRef` mark, code blocks, or headings-only nodes.
- Accessibility: menu has `role="listbox"`, items `role="option"` with `aria-selected`.
- No schema/DB changes, no backend changes, purely frontend inside the sermon editor.

## Verification

- Type "mat" in a new sermon note → dropdown shows "Matthew" first; Enter inserts `Matthew `; typing ` 6:33` produces a hoverable reference.
- Type "1 co" → "1 Corinthians" appears; Enter inserts `1 Corinthians `.
- Type "song" → "Song of Solomon" appears.
- Type inside an existing word ("format") → no menu.
- Esc closes menu; clicking outside closes menu.