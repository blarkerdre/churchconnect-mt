# Make Bible Book Autocomplete Tap-Selectable on Screen

Currently the autocomplete suggestions can only be chosen with the keyboard. On mobile/touch (the primary viewport here is 384px), tapping a suggestion doesn't work reliably because:

1. `editor.on("blur", close)` fires the instant the user touches outside the editor, closing the menu before the click lands.
2. Only `onMouseDown` is `preventDefault`ed — touch events (`touchstart`) still let the editor lose focus.
3. Fixed positioning at the caret can push the menu off the right edge of a 384px screen.

## Changes to `src/components/sermons/BibleBookAutocomplete.jsx`

- Remove the `editor.on("blur", close)` handler. Close is already handled on Escape, selection change away from the token, and clicks outside.
- Add an outside-click/tap listener on `document` (`pointerdown`) that closes the menu only if the target is not inside the popover and not inside the editor DOM.
- On each option button, add `onTouchStart={(e) => { e.preventDefault(); insert(name); }}` in addition to the existing `onClick`, so a tap immediately selects without waiting for the synthesized click (which can be swallowed by the editor stealing focus).
- Also add `onPointerDown={(e) => e.preventDefault()}` on the popover container so the underlying editor selection is preserved during the tap.
- Clamp the popover position within the viewport: after measuring, if `x + width > innerWidth - 8`, shift left; if `y + height > innerHeight - 8`, flip above the caret. Use a ref + `useLayoutEffect` to measure and adjust.
- Increase touch target: each option gets `py-2 min-h-[36px]` on small screens.
- Add a subtle header row "Bible books" so users understand what the list is on mobile (optional, small `text-[10px] uppercase text-muted-foreground px-2 py-1`).

No changes to `refs.js`, `SermonRichEditor.jsx`, or the extension — this is purely UX polish on the existing dropdown.

## Verification

- On a 384px viewport, type "mat" in a sermon note — the menu appears near the caret, fully within the screen.
- Tap "Matthew" with a finger (or click in devtools touch emulation): the word is replaced with `Matthew ` and the menu closes; the editor stays focused so the user can keep typing `6:33`.
- Type " " or move the caret elsewhere — the menu closes automatically.
- Keyboard flow (↑/↓/Enter/Tab/Esc) continues to work unchanged.