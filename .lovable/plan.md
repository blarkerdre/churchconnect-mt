# Fix: Lecturer Feedback tab layout keeps resizing on mobile

## Diagnosis

On a 384px viewport the Lecturer Feedback Report card oscillates because of two interacting layout issues in `src/components/exams/LecturerFeedbackReport.jsx`:

1. **Recharts `ResponsiveContainer` with no explicit `width`/`height` props** (lines 453–463) is wrapped in `<div className="h-48 w-full">`. On narrow screens, when its measured width crosses a threshold that adds/removes a Y-axis tick label, the SVG re-lays out, the parent's intrinsic width nudges, and the container re-measures — a classic recharts feedback loop. It only kicks in when the "Distribution" tab is active, but any user who lands there sees the whole card shimmy.

2. **Filter grid + summary tiles overflow the row.** The filter card uses `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` inside a parent that isn't `min-w-0`, and `SelectTrigger` content (long course/lecturer names) plus the search input can push the grid past 384px. That triggers a horizontal scrollbar on the outer `Card`, which then removes itself when React re-renders shorter content — causing the whole card to breathe in/out.

3. **Summary tile trend Badge** wraps to a new line intermittently as `summary.trend` recomputes, adding/removing tile height across the 2-col mobile grid.

## Changes (frontend only, single file)

`src/components/exams/LecturerFeedbackReport.jsx`

1. **Stabilise the chart container**
   - Replace `<div className="h-48 w-full"><ResponsiveContainer>…` with `<ResponsiveContainer width="100%" height={192} debounce={50}>…` directly, and wrap in `<div className="w-full min-w-0">`. Explicit numeric `height` + `debounce` breaks recharts' resize loop.

2. **Prevent horizontal overflow of the card**
   - Add `min-w-0` to `CardContent` and to the filter grid wrapper.
   - Add `truncate` on `SelectValue` triggers (`className="h-8 text-xs [&>span]:truncate"`).
   - Wrap the header action buttons row in `flex-wrap` (already partly there) and add `shrink-0` to the buttons.

3. **Keep summary tiles uniform height**
   - Add `min-h-[64px]` to `SummaryTile`'s root and `flex-wrap` on the value+trend row so the badge doesn't push tile height taller than its neighbours.

4. **Guard the Distribution tab render**
   - Change `<TabsContent value="distribution">` so the chart only mounts when the tab is actually selected (use Radix `forceMount`-free default — already the case — but additionally gate the `ResponsiveContainer` behind a `useState` `activeTab` so switching away unmounts recharts cleanly and prevents residual ResizeObserver callbacks).

## Out of scope

- No data/query changes, no edge-function or RLS changes.
- No visual redesign — same tiles, tables, and chart, just stabilised.
- Desktop layout is unaffected (changes are additive: `min-w-0`, `truncate`, fixed chart height).

## Verification

- Open `/exams` → Lecturer Feedback tab on the 384px preview; card no longer oscillates.
- Switch to Distribution tab; chart renders once at 192px tall and stays put.
- Long lecturer/course names truncate inside their Select triggers instead of widening the grid.
