## Root cause

On touch, the autocomplete menu currently inserts **and closes** synchronously in `onPointerDown`. After the menu unmounts, the browser still dispatches the follow-up `click` (a "ghost click") at the same screen coordinates. On the 384px sermon-note dialog, the suggestion row sits directly above the Save button — so that ghost click lands on **Save**, which submits the form and closes the dialog. Keyboard selection isn't affected because it never produces a synthesized click.

## Fix (single file)

`src/components/sermons/BibleBookAutocomplete.jsx` — change the option-button event model so the menu stays mounted through the entire tap sequence and swallows the ghost click:

- On each option button:
  - `onPointerDown`: only `e.preventDefault()` (keeps editor focus, does **not** insert or close).
  - `onClick`: `e.preventDefault(); e.stopPropagation();` then call `insert(name)` (this is where the menu closes). Because the button is still mounted when the click dispatches, the click lands on the button, not on Save.
- After `insert()` runs, install a one-shot capture-phase `click` listener on `document` that `preventDefault`+`stopPropagation`s the very next click within ~350ms and then removes itself. This absorbs any residual synthesized click from touch devices where the button unmounts before the click phase.
- Keep the existing outside-`pointerdown` closer, keyboard shortcuts, viewport clamping, and portal-into-`containerRef` behaviour unchanged.

No other files change.

## Verification

- 384px, sermon-note dialog: type "Zace" → menu shows Zechariah/Zephaniah/Ezekiel. Tap "Ezekiel" (even when it visually overlaps the Save button area) → text becomes `Ezekiel `, menu closes, dialog stays open, Save is **not** triggered.
- Desktop mouse click on an option still inserts and closes.
- Keyboard (↑/↓/Enter/Tab/Esc) unchanged.
- Outside tap still closes the menu without inserting.
