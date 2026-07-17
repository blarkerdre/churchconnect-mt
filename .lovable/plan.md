# Bible Verse Hover Links in Sermon Notes

Add hoverable Bible reference links inside the Sermon Notes rich editor. Hovering (or tapping on mobile) a reference like `John 3:16` shows a small popover with the KJV verse text. Works fully offline — no API calls.

## Scope
- Applies only to the Sermon Notes editor (`SermonRichEditor.jsx`) and its rendered read view.
- No backend/database changes. No new secrets.

## What we'll build

### 1. Bundled KJV data
- Add `src/assets/bible/kjv.json` (compact structure: `{ "Gen": { "1": { "1": "In the beginning..." } }, ... }`), ~4–5 MB. Loaded lazily via dynamic `import()` only when the editor or a sermon view mounts, so it doesn't affect the rest of the app's initial bundle.
- Add `src/lib/bible/refs.js` with:
  - Canonical book list + aliases (e.g. `Gen`, `Genesis`, `Ge`, `1 Cor`, `1 Corinthians`, `I Cor`, `Rom`).
  - Regex to detect references: `Book Chapter[:Verse[-Verse]][, Verse[-Verse]]*` (single-chapter refs, verse ranges, comma-separated verses).
  - `parseReference(text)` → `{ book, chapter, verses: [{start, end}] }` or `null`.
  - `lookupVerses(ref)` → `[{ ref: "John 3:16", text: "For God so loved..." }, ...]` using the lazy-loaded KJV JSON.

### 2. Tiptap "BibleRef" mark/extension
- Create a custom Tiptap mark `BibleRef` in `src/components/sermons/extensions/BibleRef.js` that wraps a reference span with `data-bible-ref="John 3:16"` and a distinct class (underline dotted, primary color).
- Add an InputRule/PasteRule that auto-detects references as the user types or pastes, converting matching text into `BibleRef` marks. Uses `parseReference` to only mark valid book names.
- Register the extension in `SermonRichEditor.jsx`.

### 3. Toolbar insert button
- Add a "Verse" button to the `MenuBar` in `SermonRichEditor.jsx` (next to the Pen button).
- Opens `InsertBibleRefDialog.jsx` with:
  - Book select (grouped OT/NT).
  - Chapter and Verse (start/end) inputs.
  - Live preview of the verse text.
  - "Insert" → inserts the reference text wrapped in a `BibleRef` mark at the cursor.

### 4. Hover popover
- Create `src/components/sermons/BibleRefPopover.jsx`. It's a single popover host that attaches one delegated `mouseover`/`focusin`/`click` listener to any container passed in via ref.
- When a `[data-bible-ref]` element is hovered/tapped, it reads the reference, calls `lookupVerses`, and renders a shadcn `Popover` anchored to the element with:
  - Bold reference header (e.g. `John 3:16 (KJV)`).
  - Verse text (or multiple verses joined for ranges).
  - Small "Verse not found" fallback when parsing fails.
- Mobile: tap toggles the popover; a second tap or outside tap dismisses.

### 5. Wire into editor + reader
- Editor: wrap `EditorContent` in a container ref and mount `BibleRefPopover` bound to it, so refs are hoverable while editing.
- Reader: any place that renders saved sermon HTML (e.g. `SermonNotes.jsx` view / `SermonNoteFormDialog.jsx` read view) gets the same `BibleRefPopover` attached to the rendered HTML container so links work on read-only view too.

## Technical details

```text
src/
  assets/bible/kjv.json                     (new, lazy-loaded)
  lib/bible/refs.js                         (parse + lookup, dynamic import kjv.json)
  components/sermons/
    extensions/BibleRef.js                  (Tiptap mark + InputRule/PasteRule)
    BibleRefPopover.jsx                     (delegated hover popover)
    InsertBibleRefDialog.jsx                (toolbar insert dialog)
    SermonRichEditor.jsx                    (add extension, toolbar button, mount popover)
  pages/SermonNotes.jsx                     (attach popover to rendered HTML view)
```

- Reference regex handles: `Gen 1:1`, `Genesis 1:1-3`, `1 Cor 13:4-7`, `John 3:16, 18`, `Ps 23`. Common false-positives (e.g. time `3:16pm`) are avoided by requiring a known book alias immediately before the numbers.
- KJV file is not preloaded; `import("@/assets/bible/kjv.json")` runs on first parse/lookup and is cached in-module.
- Popover uses existing `shadcn/ui` `Popover`. Styling matches app theme (navy/gold tokens already in `index.css`).
- Saved HTML stores `<span data-bible-ref="John 3:16" class="bible-ref">John 3:16</span>`, so hover still works after reload; sanitization already handled by Tiptap output — no `dangerouslySetInnerHTML` risk.

## Out of scope
- Non-KJV translations, cross-references, verse search across the whole Bible, sharing verses to other modules.

