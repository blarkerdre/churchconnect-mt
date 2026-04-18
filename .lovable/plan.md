
## Issue
On 384px viewport, both "Refer to Unit Leader" (church unit dropdown) and "Refer to Home Cell" (centre dropdown) selections inside `SignPostDialog` aren't working. The network logs confirm:
- `church_units` query DID return data (200 OK with the duplicated `tenant_id` filter — units exist for `demo-test`).
- Session replay shows the user opened the Church Unit select (`Select unit` placeholder visible) and tapped, then opened the Home Cell select where Canton Centre appeared but selection didn't commit either.

So units/centres ARE loading. The actual problem is the **Select dropdown is not selecting/closing on tap** in this 384px mobile context.

## Root cause analysis

Looking at the flow:
1. User opens dialog → both `Select` components render inside a Radix `Dialog`.
2. Tapping a `SelectItem` should fire `onValueChange` → update local state → render the next step (e.g. show leader info, enable Submit).
3. Session replay shows after Canton Centre tap, the UI did update to show "Blarker Dre · Canton Centre" — so Home Cell DID select successfully. The user's complaint is likely that **after selecting, nothing visibly progresses** OR the **Submit button stays disabled / no feedback**.

For the Unit dropdown: the replay shows it opened but no item-tap event was captured before the user moved on — suggesting on a 384px viewport, the `SelectContent` may be opening **off-screen / behind the Dialog** or items are not tappable due to z-index/portal issues common with Radix Select inside Dialog on mobile.

## Likely culprits (in order)
1. **Radix Select inside Dialog z-index/portal conflict on mobile** — `SelectContent` portals to body but the Dialog overlay traps pointer events on small viewports. Common fix: ensure `SelectContent` has explicit `z-50` (or higher than dialog overlay `z-50`), or use `position="popper"` + `sideOffset`.
2. **State not propagating after select** — `onValueChange` may set `selectedUnitId` but the dialog body doesn't re-render the leader-resolution / submit affordance, leaving the user thinking nothing happened.
3. **No visible "next step" after picking** — after selecting a unit, dialog should clearly show the resolved leader and an enabled Submit button. If that block is below the fold on 384×671, user can't see the result.

## Plan

I'll inspect `SignPostDialog.jsx` end-to-end to confirm:
- The `Select` components for both unit_leader and wsf_centre tabs.
- The `SelectContent` z-index and portal setup.
- Whether the resolved leader / Submit button appears visibly after a selection.
- Whether `onValueChange` correctly updates state used by the submit handler.

Then fix:

1. **Mobile dropdown reliability**: ensure both `SelectContent` instances render with `position="popper"` and high `z-index` so they appear above the dialog overlay and accept taps on mobile.

2. **Auto-scroll into view after select**: when user picks a unit/centre, scroll the resolved-leader / Submit section into view so they see the next step on a 384×671 screen.

3. **Always-visible sticky Submit footer**: convert the dialog footer (Submit button) into a sticky footer at the bottom of `DialogContent` so the user can always see and tap it without scrolling, regardless of dropdown state.

4. **Visible feedback on selection**: after a unit/centre is picked, render a clear inline confirmation card ("✓ Will be sent to: <Leader name> for <Unit/Centre>") so the user knows the selection registered.

5. **Fallback empty-state guard**: if a tab has no items (e.g. no centres on a tenant), show a clear inline message + disable that tab rather than presenting an empty dropdown.

## Files
- **Inspect**: `src/components/followups/SignPostDialog.jsx` (full file).
- **Edit**: `src/components/followups/SignPostDialog.jsx` — apply the 5 fixes above.
- **Possibly inspect**: `src/components/ui/select.jsx` to confirm `SelectContent` z-index defaults.

After approval I'll read the current `SignPostDialog.jsx` and `select.jsx`, then apply the edits in one pass.
