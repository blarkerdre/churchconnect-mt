# Fix Touch Selection in Bible Book Autocomplete (Dialog Pointer-Events Lock)

## Root cause (verified from symptom)

The sermon editor renders inside a Radix Dialog. When a Radix Dialog is open it sets `pointer-events: none` on the body scroll-lock element and only re-enables interactivity on descendants of DialogContent. Our autocomplete menu is portalled to `document.body`, which puts it as a sibling of the Radix dialog portal — so on touch devices the menu's element never becomes a valid pointer target and `onPointerDown` never fires. Keyboard selection works because keyboard events aren't gated by `pointer-events`.

## Change (single file)

`src/components/sermons/BibleBookAutocomplete.jsx`:

- Portal the menu into `containerRef.current` (the editor wrapper, which is inside DialogContent), falling back to `document.body` only when the container ref isn't ready. Reinstate the `containerRef` prop use.
- Add `pointer-events-auto` Tailwind class to the menu wrapper and every option button as a belt-and-braces override in case any ancestor still has `pointer-events: none`.
- Keep `position: fixed` positioning (viewport-relative), which is unaffected by the portal target.
- Keep the existing `onPointerDown` insert handler, outside-tap closer, and keyboard shortcuts.

## Files touched

- `src/components/sermons/BibleBookAutocomplete.jsx` — portal target + pointer-events-auto classes.
- No other files change; `SermonRichEditor.jsx` already passes `containerRef`.

## Verification

- 384px preview, inside the sermon note dialog: type "matt" → menu appears; tap "Matthew" → text becomes `Matthew ` and menu closes; continue typing `6:33` → hoverable reference forms.
- Desktop click still selects.
- Keyboard (↑/↓/Enter/Tab/Esc) unchanged.
- Tapping outside the popover closes it; tapping the "Bible books" header does nothing and does not insert.