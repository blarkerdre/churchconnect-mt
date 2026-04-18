
## Diagnosis

Two symptoms when clicking **Refer to Unit Leader**:
1. **Button does nothing** — no dialog visible.
2. **Page becomes unscrollable** — body scroll is locked.

This combination is the classic symptom of a Radix Dialog whose **overlay/portal mounted but content failed to render** (or rendered off-screen). Radix locks `body` scroll on open; if the content errors during render, the dialog stays "open" but invisible, leaving the page frozen.

Looking at `SignPostDialog.jsx` after the recent edits, the most likely render-time crash points are:

- **`selectedCentre` / `centreLeader` query refs**: `selectedCentre?.leader_id` is referenced inside `useQuery({ enabled: !!selectedCentre?.leader_id })`. When `type === "unit_leader"`, `selectedCentre` is undefined — fine. But the **toast effects** I added run unconditionally and reference `centres`, `suggestedCentre`, `centreLeader` even on the unit path, and the guard refs may misfire and trigger toasts in a render loop.
- **Toast effect dependency arrays** likely include objects/arrays whose references change every render (`centres`, `unitLeaders`), causing the effect to re-fire → re-toast → re-render → freeze.
- **Missing `DialogDescription`** (console warns about it) is benign, not the cause.

Since I can't run the app in plan mode, I'll harden the dialog so it cannot freeze the page and add a clear render-error boundary.

## Fix

**`src/components/followups/SignPostDialog.jsx`** — three targeted changes:

1. **Gate every "home cell" effect with `type === "home_cell_leader"`** so they don't run when the unit path is active. Currently some toast effects fire regardless of `type`, referencing `centres`/`suggestedCentre` → can produce stale-closure loops.

2. **Stabilize toast-effect dependencies**: depend only on primitive flags (`centres.length`, `!!suggestedCentre`, `centreLeader?.linked`, `unitLeaders.length`, `unitName`, `open`, `type`) — never the array references themselves. Keep the existing `useRef` one-shot guards.

3. **Wrap dialog body in a try/catch render guard**: extract the form into a small inner component and wrap its render in an error boundary fallback. If anything throws, the dialog still shows a "Something went wrong, please close" message instead of mounting an empty overlay that locks scroll.

4. **Add `DialogDescription`** (silences a11y warning, also forces Radix to flush content).

5. **Defensive close handler**: `onOpenChange={(o) => { if (!o) { /* reset all local state */ } onOpenChange(o); }}` to ensure scroll lock is always released.

## Files Changed
- `src/components/followups/SignPostDialog.jsx` — gate effects by `type`, stabilize deps, add `DialogDescription`, add render error boundary, defensive close (~30 lines net).

No DB changes. After this lands, please click **Refer to Unit Leader** again and share any console output starting with `[SignPost]` so we can confirm the unit path now opens cleanly.
