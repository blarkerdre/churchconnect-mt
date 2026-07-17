## Change

Remove the auto-close timer on the Teens check-in/out success screen so the page stays open until the user taps **Close**.

### File
- `src/pages/TeensCheckin.jsx`

### Edits
- Remove the 6-second `setTimeout` that calls `handleClose` after a successful check-in/out.
- Keep the "Close" button and the "You can close this tab now." fallback message intact.
- Leave all other behavior (random welcome/farewell image, caption, status messages) unchanged.

No backend, RPC, or styling changes.