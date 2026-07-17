# Fix Tap/Click Selection on Bible Book Autocomplete

The listbox appears but taps don't insert the option. Three overlapping causes:

1. The container-level `onPointerDown={preventDefault}` on Chromium mobile can cancel the synthesized `click`, so `onClick` doesn't fire.
2. Options have both `onTouchStart` (calls insert) and `onClick` (calls insert) — different paths win on different devices, and the touchstart path prevents default which can leave the click as a no-op or double-fire depending on browser.
3. `insert()` calls `editor.chain().focus()...` — on mobile, calling focus during a touch handler opens the virtual keyboard and can cancel the touch sequence before the DOM update commits.

## Change (single file)

`src/components/sermons/BibleBookAutocomplete.jsx`:

- Replace each option's `onMouseEnter` + `onTouchStart` + `onClick` with a single `onPointerDown={(e) => { e.preventDefault(); insert(name); }}`. This fires synchronously for mouse, pen, and touch, before any focus/blur race, and preserves the editor selection because default is prevented.
- Remove `onPointerDown={preventDefault}` and `onMouseDown={preventDefault}` from the popover container. Put `onPointerDown={(e) => e.preventDefault()}` on the "Bible books" header row only so tapping the header does nothing.
- In `insert()`, drop `.focus()`: use `editor.commands.insertContentAt({from, to}, \`${name} \`)`. Focus is already retained via preventDefault on pointerdown, and skipping `.focus()` avoids re-triggering the mobile keyboard mid-touch.
- Outside-tap listener: use `e.composedPath?.() ?? [e.target]` and check whether the menu ref is in the path, so taps that start on inner text nodes still resolve as "inside menu".
- Add `select-none touch-manipulation` Tailwind classes to option buttons to disable double-tap zoom and remove the 300ms click delay.
- Keep highlight-on-hover for desktop by adding a small `onMouseMove={() => setIndex(i)}` handler on each option (cheaper than mouseenter and doesn't interfere with pointer events).

## Verification

- 384px viewport: type "matt" → menu shows Matthew; tap "Matthew" → text becomes `Matthew ` and menu closes; continue typing `6:33` → hoverable reference forms.
- Desktop click: same behavior.
- Keyboard flow (↑/↓/Enter/Tab/Esc) unchanged.
- Tapping outside closes the menu; tapping the "Bible books" header does not close it and does not insert.