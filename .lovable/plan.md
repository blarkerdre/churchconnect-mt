## Guided walkthrough — My Family & Children Church

A lightweight in-app product tour that spotlights UI elements, shows a tooltip with step copy, and advances via Next/Back/Skip. Auto-runs once per user per tour, and can be re-opened anytime via a "?" Help button in each page header.

### 1. Tour engine (in-house, ~150 LOC, no new deps)

New files:

- `src/components/tour/TourProvider.jsx` — context + state (active tour id, current step, open/close, complete).
- `src/components/tour/SpotlightTour.jsx` — the overlay. Renders:
  - A full-screen SVG mask with a rounded-rect cutout around the target element's bounding box (measured via `getBoundingClientRect` + `ResizeObserver` + scroll listener, re-measured on every step).
  - A floating tooltip card (title, body, "Step X of Y", Back / Skip / Next / Finish buttons) auto-placed above/below the target using a simple flip algorithm.
  - Scrolls the target into view with `scrollIntoView({ block: 'center' })` before measuring.
  - Handles missing targets gracefully (falls back to a centered modal for that step).
  - Keyboard: →/Enter next, ← back, Esc skip. Focus trap inside the tooltip.
- `src/components/tour/tours.js` — declarative tour definitions:

  ```js
  export const TOURS = {
    'my-family-v1':      { title: 'My Family tour', steps: [ { selector: '[data-tour="mf-add-child"]', title: '…', body: '…' }, … ] },
    'children-church-v1':{ title: 'Children Church tour', steps: [ … ] },
  };
  ```

- `src/components/tour/HelpButton.jsx` — small `?` icon button placed in each page header that calls `startTour(id)`.
- `src/hooks/useTourCompletion.js` — reads/writes completion state (see §3).

Mount `<TourProvider>` inside `AppLayout` so both pages share it, and render `<SpotlightTour />` once at the provider root.

### 2. Anchoring the steps

Add `data-tour="…"` attributes to the existing elements — no visual changes to the pages. Proposed anchors:

**My Family (`src/pages/MyFamily.jsx`)** — parent audience:
1. `mf-add-child` — the "Add child" button (welcome + why).
2. `mf-child-card` — first child card (view/edit profile, medical/allergy notes).
3. `mf-authorised-adults` — Authorised pickup adults section (who can collect).
4. `mf-add-authorised` — search box for adding an authorised adult.
5. `mf-pickup-code` — one-time pickup code / delegation area.
6. `mf-help` — Help button (reminder they can re-open the tour).

**Children Church (`src/pages/ChildrenChurch.jsx`)** — worker audience, steps auto-skip when the tab/section isn't visible for the user's role:
1. `cc-checkin-search` — family search on Drop-off tab.
2. `cc-checkin-confirm` — check-in confirm + PIN delivery explanation.
3. `cc-pickup-search` — Pickup tab search.
4. `cc-pickup-verify` — PIN entry / authorised adult verification.
5. `cc-leader-override` — override button (leader/admin only — step conditionally included).
6. `cc-all-children` / `cc-report` — leader/admin-only steps, conditionally included.
7. `cc-help` — Help button.

Tour steps take an optional `when: (ctx) => boolean` so role-gated steps are dropped for users who can't see them.

### 3. Trigger + persistence

- **Auto-run on first visit:** on mount of MyFamily / ChildrenChurch, `useTourCompletion(tourId)` checks completion; if not completed, start after a 600 ms delay (lets the page's data-loading skeletons resolve so anchors exist).
- **Manual:** Help button in each page header always calls `startTour(tourId)`, ignoring completion.
- **Persistence:** new table `user_tour_completions` (per user, per tour id) so it works across devices.

  ```sql
  create table public.user_tour_completions (
    user_id uuid not null references auth.users(id) on delete cascade,
    tour_id text not null,
    completed_at timestamptz not null default now(),
    primary key (user_id, tour_id)
  );
  grant select, insert, update, delete on public.user_tour_completions to authenticated;
  grant all on public.user_tour_completions to service_role;
  alter table public.user_tour_completions enable row level security;
  create policy "own rows read"   on public.user_tour_completions for select to authenticated using (user_id = auth.uid());
  create policy "own rows write"  on public.user_tour_completions for insert to authenticated with check (user_id = auth.uid());
  create policy "own rows update" on public.user_tour_completions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  ```

  Row is written when the tour is finished OR skipped (so "skip" is also remembered). `localStorage` is used as an instant cache to avoid the flash while the DB round-trip completes.

### 4. Styling

Uses existing shadcn tokens (Card, Button, Playfair headings, Source Sans body, navy/gold palette). Overlay is `bg-black/60`, tooltip is a `Card` with a small gold accent border to match the app's branding. No new fonts, no new colors, mobile-responsive (tooltip becomes a bottom sheet under 480 px).

### 5. Out of scope

- No changes to My Family or Children Church business logic.
- No admin analytics of who completed the tour (can add later).
- No editor for tour content — steps live in code.

### Files touched

- **New:** `src/components/tour/TourProvider.jsx`, `SpotlightTour.jsx`, `tours.js`, `HelpButton.jsx`; `src/hooks/useTourCompletion.js`; one migration.
- **Edit:** `src/components/layout/AppLayout.jsx` (mount provider), `src/pages/MyFamily.jsx` and `src/pages/ChildrenChurch.jsx` (add `data-tour` attrs, Help button, auto-start hook).
