The Bible verse popover currently renders through a portal to `document.body` while the sermon editor sits inside a modal dialog. That puts the popover outside the dialog’s scroll/interaction boundary, so on mobile especially the drag gesture is handled by the dialog/page instead of the verse panel. The popover also uses touch/wheel propagation handlers that are too fragile for nested mobile scrolling.

Plan:
1. Update the Bible verse popover so its scrollable verse area is a stable element with a real height constraint, not only `maxHeight`.
2. Keep the popover interaction inside the sermon editor/dialog boundary where possible, or explicitly make the portal popover pointer/touch-scroll safe.
3. Replace the fragile callback ref event listener with React-managed handlers that allow native scrolling inside the verse body while preventing the page/dialog behind it from moving.
4. Verify on mobile width that a long passage scrolls inside the popover, the close button still works, and the sermon note dialog itself does not move while the verse is being scrolled.

Technical details:
- Main file: `src/components/sermons/BibleRefPopover.jsx`
- Likely fix: add a dedicated scroll body with `overflow-y-auto`, `min-h-0`, `max-h`/height constraints, `touch-action: pan-y`, `overscroll-contain`, and safer touch/wheel handling.
- If needed, adjust the portal target so the popover remains compatible with `DialogContent`.