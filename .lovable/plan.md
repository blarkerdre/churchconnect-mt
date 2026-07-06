## Why Skip / Close doesn't stick during an auto-run tour

The Skip, X and Escape handlers actually work — they call `onClose`, which marks the tour completed (localStorage + `user_tour_completions` upsert) and clears `active`. The overlay does close.

The problem is that it **reopens on its own within a second**, so it feels like Skip did nothing.

### Root cause

`useAutoTour` re-fires whenever its `tour` dependency changes:

```js
// src/hooks/useAutoTour.jsx
useEffect(() => {
  if (completed !== false) return;
  const t = setTimeout(() => tour.startTour(tourId, ctx), 700);
  return () => clearTimeout(t);
}, [tourId, completed, tour]);
```

- `tour` is the value from `TourProvider`, memoized on `baseCtx` (auth roles + tenant flags). Every time auth finishes loading, roles arrive, or tenant memberships refresh, `TourCtx.Provider value` gets a new reference → `tour` changes → this effect re-runs.
- `completed` in this hook instance is still `false` right after Skip. `useTourCompletion` only updates its own state; it does not observe the write that `TourProvider.markCompletedRemote` performs. So the guard `completed !== false` is still false → the tour is scheduled again → user sees it reopen after ~700 ms.
- Same thing happens if the user clicks Skip while `completed` is `null` (fetch still in flight) and the fetch then resolves to `false`.

Result: the user cannot skip/exit/close because the auto-run keeps re-triggering on the same page load.

### Fix (small, contained to the tour layer)

1. **Remember dismissals per session.** In `TourProvider.startTour`, skip starting a tour whose id is in an in-memory "dismissed this session" set. `onClose` and `onComplete` add the id to that set (in addition to the existing `markCompletedRemote`). This alone stops the re-open loop even if `completed` is stale.
2. **Re-read completion after close.** Expose a `markLocalCompleted(tourId)` callback from `TourProvider` (or reuse `useTourCompletion` inside it) so the same key that `useAutoTour` watches flips to `true` synchronously. Simplest: have `TourProvider` write `localStorage` (already done) AND broadcast via a small event/atom that `useTourCompletion` subscribes to, so `completed` becomes `true` immediately.
3. **Stabilise `useAutoTour` deps.** Drop `tour` from the dependency array (use a ref) so identity churn on the context value can't re-trigger the auto-start. The effect only needs to fire when `tourId` or `completed` changes.
4. **Guard against double-start.** In `startTour`, no-op if `active?.tourId === tourId` or if the tour is already in the dismissed set.

### Files to touch

- `src/components/tour/TourProvider.jsx` — add session-dismissed set, guard `startTour`, notify listeners on completion.
- `src/hooks/useAutoTour.jsx` — remove `tour` from deps, use a ref; bail out if the provider reports the tour as dismissed.
- `src/hooks/useTourCompletion.js` — subscribe to the provider's completion signal so `completed` flips to `true` right after Skip/Close/Finish.

### Out of scope

- No changes to `tours.js`, no new `data-tour` anchors, no UI/CSS changes to the overlay, no changes to `ModuleTour` or `HelpButton`. The manual "Tour" button behaviour stays identical — it always starts the tour on demand (it can bypass the dismissed set).

### Verification

- Load a page fresh as a user with no completion row → tour auto-opens → click Skip → tour stays closed and does not reappear on role/tenant hydration.
- Same with the X button and the Escape key.
- Navigate away and back on the same session → tour does not auto-open.
- Click the "?" Tour button → tour opens on demand.
- After "Replay all tours" in Settings, auto-open works again on next visit.
