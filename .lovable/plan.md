## Bug

In `src/components/exams/SendResultsDialog.jsx`, the certificate-preview `useEffect` (starts around line 69) lists `certPreviews` in its dependency array while also calling `setCertPreviews` inside the effect. This creates a self-cancelling race:

1. Effect runs, guard passes, we call `setCertPreviews(... {loading:true})` and kick off `supabase.functions.invoke("issue-certificate", { preview:true })`.
2. That `setCertPreviews` re-renders the parent, changing `certPreviews`.
3. React runs the effect **cleanup**, setting `cancelled = true`, then re-runs the effect. The re-run bails at `if (certPreviews[activeMemberId]) return;` because the loading entry is now present.
4. The in-flight async eventually resolves — but `cancelled` is already `true`, so the success/error branch returns early and **never clears the `loading:true` state**.

Result: the certificate preview shows the spinner forever, even though the edge function returned the image. The Bible School (WoFBI) certificate preview is the one that surfaces this most visibly.

Also contributing: the parent (`CourseResultsView`) passes a freshly-created `members` array on every render (`members.filter(...).map(...)` inline in JSX), which further multiplies effect re-runs.

## Fix

Only touch `src/components/exams/SendResultsDialog.jsx`. No edge function, RLS, template, or backend changes.

1. **Break the state feedback loop.** Remove `certPreviews` from the effect's dependency array. Replace the "already have preview?" guard with a `useRef` set (`inflightRef` / `loadedRef`) that tracks which member ids have been kicked off or completed, so the guard no longer depends on rendered state.
2. **Keep cancellation correctness.** Retain the `cancelled` flag but scope it to genuine unmount / dialog-close / activeMember switch. Because deps no longer include `certPreviews` or the unstable `members` reference, the effect won't cancel itself mid-flight.
3. **Stabilise the `members` input.** Depend on `activeMemberId` and a small primitive (e.g. `activePassed = !!activeMember?.passed`) rather than the whole `members` array. Look up `activeMember` inside the effect body from the latest prop via a ref if needed.
4. **Reset tracking when the dialog closes.** In the existing `open`-close effect that already clears `certPreviews`, also clear the new refs so reopening the dialog re-fetches cleanly.
5. **Preserve existing behaviour.** Loading/error UI, `issue-certificate` call shape (`preview: true`, reissue detection via `training_completions`), and the send flow stay identical.

## Verification

- Reproduce: open Course Results → select a passed Bible School member → click **Preview & Send…** → confirm the certificate preview image renders (no perpetual spinner) and switching between members loads their preview correctly.
- Confirm existing behaviour: statement preview still renders, "Send" still works, closing/reopening the dialog re-fetches, error state still shows the failure message.

## Out of scope

- `issue-certificate` edge function, template configuration, DNS / email delivery.
- Statement of Result (`StatementOfResult` / `StatementPreview`) — its preview renders synchronously and is not affected by this bug.
- Refactoring `CourseResultsView`'s `members` memoisation beyond what's needed for this fix.