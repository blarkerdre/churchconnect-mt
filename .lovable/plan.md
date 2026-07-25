## Problem

In `src/components/sermons/BibleRefPopover.jsx`, tapping a Bible reference opens a fixed popover. On mobile, long passages (e.g. Psalm 119) don't scroll inside the tooltip because:

1. The scrollable inner div uses a fixed `max-h-[240px]`, but the popover itself is positioned only ~260px from the viewport bottom, so part of the scroll region sits below the screen and the visible area can't be dragged.
2. Touch scroll gestures inside the popover bubble up to the editor / page, and iOS Safari treats them as taps that trigger the outside-click handler, closing the popover mid-scroll.
3. No `touch-action` / `overscroll-behavior` is set, so momentum scroll is inconsistent.

## Fix (frontend only, `BibleRefPopover.jsx`)

- Make the mobile popover a proper bottom sheet sized to the viewport:
  - Position it with `bottom: 8px` (instead of computing `top` from `innerHeight - 260`) and cap overall height to `min(60vh, 420px)`.
  - Give the outer popover `display:flex; flex-direction:column` so the header stays fixed and the verse area fills remaining height.
- Replace the inner `max-h-[240px]` with `flex-1 min-h-0 overflow-y-auto` so the scroll region always fits inside the visible popover.
- Add `touchAction: 'pan-y'` and `overscrollBehavior: 'contain'` to the scroll container, and stop `touchstart`/`touchmove`/`click` propagation on the popover root so scrolling doesn't trigger the document-level close handler.
- Keep desktop behaviour unchanged (still 320px wide, anchored to the reference) but also apply `overscroll-contain` to its scroll region for consistency.

No changes to Bible data, editor, or extension logic.
