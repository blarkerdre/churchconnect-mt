## Root cause

The popover is portaled to `document.body`, but on mobile the verse text still doesn't scroll — the page behind moves instead. Two issues in `src/components/sermons/BibleRefPopover.jsx`:

1. **Layout isn't giving the inner div a bounded height.** The outer popover uses `maxHeight: min(60vh, 420px)` + `display:flex` + child `flex-1 min-h-0`. Because the parent's height is `auto` (only capped by max), the flex child often collapses to content height on iOS Safari, so the inner div isn't actually a scroll container and touches scroll the body.
2. **React `onTouchMove` stopPropagation doesn't stop native listeners.** The document-level and window-level scroll handlers (and the page body's scroll) receive the touchmove regardless. Need a native, non-passive `touchmove` listener attached to the popover element.

## Fix (frontend only, `BibleRefPopover.jsx`)

- Give the scroll region an **explicit bounded height** instead of relying on flex:
  - Drop `flex-1 min-h-0` on the inner div and the flex wrapper on the outer div.
  - Set the inner scroll div's `maxHeight` directly: `min(50vh, 340px)` on mobile, `min(60vh, 300px)` on desktop.
  - Keep the outer popover sized to content so the header always shows above the scroll region.
- Keep mobile bottom-sheet positioning (`bottom: 8px`, `left/right: 8px`).
- Attach a **native** `touchmove` listener via `ref` + `useEffect` on the scroll div with `{ passive: true }` that calls `e.stopPropagation()`, so touchmove never reaches the page/editor.
- Keep `overscrollBehavior: contain`, `touchAction: pan-y`, `WebkitOverflowScrolling: touch` on the scroll div.
- Leave desktop hover behaviour, close button, retry, and popover open/close logic unchanged.

No changes to Bible data, editor extension, or autocomplete.
