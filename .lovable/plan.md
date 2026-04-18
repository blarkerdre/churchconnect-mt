
The user reports the app hangs when clicking "Refer to Leader" inside the Sign-Post flow. Let me investigate.

Looking at `SignPostDialog.jsx` (already in context), the dialog itself looks fine. But let me check how it's wired in `FollowupDetailPanel.jsx` — that's the most likely site of the hang (e.g. an infinite render loop or blocking effect).

Likely suspects:
1. The dialog opens but a query inside it spins forever (e.g. `unitLeaders` query has a bad `enabled` condition or missing tenant filter that causes an infinite refetch).
2. A `useEffect` in the dialog causes a state-update loop (the `suggestClosestWSFCentre` effect re-runs because `centres` array identity changes each render).
3. The button handler is doing something blocking before opening the dialog.

Looking at the SignPostDialog code carefully:

```js
useEffect(() => {
  if (type === "home_cell_leader" && centres.length && !centreId && member) {
    const suggestion = suggestClosestWSFCentre(...);
    if (suggestion) setCentreId(suggestion.id);
  }
}, [type, centres, member, centreId]);
```

This is fine — once `centreId` is set, the condition `!centreId` becomes false and it stops.

But — `centres` is a query result; React Query returns the same array reference between renders unless data changes, so this is OK.

The more suspicious thing: the **`unitLeaders` query** uses `scopeQuery` to filter `unit_leader_assignments` by tenant — but the `profiles` follow-up query does NOT filter by tenant (`.in("user_id", ids)` only). That's fine functionally.

Actually re-reading carefully: when user opens the dialog, default `type === "unit_leader"` and the centres query is disabled. The unit query loads church units. Nothing should hang on open.

I need to actually inspect `FollowupDetailPanel.jsx` to see how `SignPostDialog` is wired (state, button handler) and check for infinite loops in the parent — and check `ReferralTimeline.jsx` (which we just edited) since it now also runs queries when the panel renders.

I also want to check the dev-server log and runtime errors to confirm the hang isn't actually a JS error / throw / unresolved Suspense.

## Investigation plan

1. Read `src/components/followups/FollowupDetailPanel.jsx` — see how the Sign-Post button is wired and what state controls `SignPostDialog`.
2. Read the recently-edited `src/components/followups/ReferralTimeline.jsx` — confirm the new leader-profiles query has correct `enabled` guards (`leaderIds.length > 0`).
3. Check dev-server logs and runtime errors for any thrown error around the click.
4. Check console logs for repeated requests indicating an infinite loop.

## Most likely root causes (to confirm)

- **A**: `ReferralTimeline` `useQuery` for leader profiles uses `leaderIds` as a dependency in `queryKey` — if `leaderIds` is recomputed as a new array each render with the same contents, React Query refetches infinitely → main thread saturated → app appears hung. The fix: stabilize via `useMemo` and use a stable string key (e.g. `leaderIds.join(",")`) inside `queryKey`.

- **B**: In `SignPostDialog`, the `unitLeaders` query has no tenant scope on the `profiles` lookup — usually fine but if RLS denies and React Query retries, could feel slow. (Minor, not a hang.)

- **C**: The Sign-Post button in `FollowupDetailPanel` accidentally calls a synchronous heavy operation (e.g. `JSON.stringify` of huge state, or sets state inside render) before opening dialog.

Most likely is **A** — the timeline change shipped in the prior turn introduced a new query whose `queryKey` includes a fresh array each render. Combined with React Query's default re-render-on-data behavior, this becomes an infinite loop the moment the panel opens, and the click handler appears to "hang" because the main thread is busy.

## Plan to fix

1. **`ReferralTimeline.jsx`** — stabilize the leader-IDs derivation:
   - Compute `leaderIds` with `useMemo` keyed off `referrals`.
   - Use a string key in the React Query `queryKey` (`leaderIds.join(",")`) instead of the array itself.
   - Same treatment for the existing `centreIds` query if present.

2. **`SignPostDialog.jsx`** — defensive cleanup:
   - Add `enabled: open && !!tenantId && unitLeaders…` guards already present. Confirm they're tight.
   - Wrap the address-suggestion `useEffect` with a guard so it only runs once per open (track with a ref) to avoid re-suggesting after user clears the centre.

3. If steps 1–2 don't fully fix it, add a one-line `console.log` at the top of the dialog and timeline render to confirm whether the loop is in the parent or child, then iterate.

### Files Changed
- `src/components/followups/ReferralTimeline.jsx` — memoize `leaderIds`/`centreIds` and fix query keys (~10 lines)
- `src/components/followups/SignPostDialog.jsx` — guard the auto-suggest effect with a ref so it runs once per open (~5 lines)

No DB changes.
