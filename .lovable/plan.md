## Goal

After a teen check-in or check-out on the Teens Check-in page, stop sending them to the Church Connect home page. Instead, show a friendly, playful image ("Welcome to church!" on check-in, "See you next time!" on check-out) and close the tab.

## Changes

### 1. Add a small pool of images
Generate a handful of illustrated, church-friendly, cartoon-style images and save them in `src/assets/teens-checkin/`:
- 4 "welcome" images (cheerful, funny — e.g. dancing teens, high-five, confetti) — used on successful check-in.
- 3 "farewell" images (waving, "see you Sunday", warm goodbye) — used on successful check-out.

All images will be lightweight cartoon illustrations, no photorealism, matching the app's friendly tone. No text baked into the image (we overlay the caption in the UI so we can localise later).

### 2. Update `src/pages/TeensCheckin.jsx`
- Import the image arrays.
- On a successful RPC result, pick a random image from the appropriate pool based on `result.action`:
  - `checked_in` / `late` → welcome pool with caption "Welcome to church!"
  - `checked_out` / `already_checked_out` → farewell pool with caption "See you next time!"
- Replace the existing success card body so it shows:
  - The randomly chosen image (rounded, ~180px tall).
  - The teen's name + session title + time-in/out summary (kept from current design).
  - A single primary button: **Close**.
- Change the button behaviour from `navigate("/")` to:
  1. Call `window.close()`.
  2. If the tab can't be closed (browser blocks it because it wasn't opened by script), replace the card content with a small "You can close this tab now." message. No redirect to `/`.
- Auto-attempt `window.close()` after ~4 seconds so the tab clears itself without user action; the manual Close button remains as a fallback.

Only the success/checkout screen changes. Error screens, magic-link screens, and the guardian teen picker are untouched.

## Technical notes

- Images generated via `imagegen` (fast tier, transparent background off, ~768×512) and referenced via ES6 imports so Vite fingerprints them.
- Random pick uses `useMemo` seeded on the result object so the image doesn't flicker on re-render.
- `window.close()` only works reliably on tabs the browser considers script-opened (QR scans usually qualify because they open a new tab). The fallback message covers the rest — no navigation back into the authenticated app.

## Out of scope

- No changes to Bible School (`WoFBICheckin.jsx`) unless you want the same treatment — happy to extend it if you say so.
- No changes to the check-in RPCs or session logic.
