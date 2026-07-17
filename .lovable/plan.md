## Fix sermon note display & update issues on Demo Church

### Likely root cause
"Only in Demo Church" almost always means that tenant's device is running a stale service-worker/HTML bundle. The Bible-book autocomplete tap fix and dialog layout tweaks are in the frontend bundle, so a cached SW on the demo domain shows old behavior even when the preview looks fine.

Secondary display issue: on 384px viewports, `SermonNoteFormDialog` uses `max-w-2xl` with `max-h-[60vh]` inner scroll, which crowds the editor and can clip the autocomplete portal.

### Changes
1. **Mobile dialog polish** (`src/components/sermons/SermonNoteFormDialog.jsx`)
   - Constrain to viewport: `w-[calc(100vw-1rem)] max-w-2xl max-h-[92vh] p-4 sm:p-6 flex flex-col`.
   - Replace `max-h-[60vh] overflow-y-auto` with `flex-1 min-h-0 overflow-y-auto` so the editor grows and toolbar stays reachable.
   - Add a visible `Label` "Service date" above the date input.

2. **Autocomplete visibility** (`src/components/sermons/BibleBookAutocomplete.jsx`)
   - Raise portal z-index and ensure it renders above the dialog scroll container by keeping `position: fixed` with a viewport-relative clamp already in place — no logic change; only bump min-width on narrow screens (`min-w-[160px]`) and add a small shadow for contrast.

3. **Force-refresh nudge for cached tenants** (`src/components/AppLayout.jsx`)
   - When `BUILD_TIME` differs from a stored `lastSeenBuild` in `localStorage`, show a one-time subtle toast "New build available — tap Refresh in the sidebar" (uses existing `forceRefresh`). No auto-reload.

### Verification
- Read current `SermonNoteFormDialog.jsx` and confirm structure before editing.
- Run Playwright at 384×673: open Sermon Notes → New Note, screenshot dialog, type "Joh" in editor, tap the "John" suggestion, screenshot the inserted text.
- Ask the user to open Demo Church, tap **Refresh** in the sidebar footer, and confirm both issues resolve.

Proceed?