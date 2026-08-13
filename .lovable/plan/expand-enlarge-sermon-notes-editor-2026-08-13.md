# Expand/Enlarge Sermon Notes Editor

## Goal
Add a user-controlled way to enlarge the notes editor in the Sermon Note form so the notes portion has more room when writing longer content.

## Current State
- The `SermonNoteFormDialog` uses a `max-w-2xl` dialog with `max-h-[92vh]`.
- The `SermonRichEditor` editor surface is limited to `max-h-[400px]` with its own overflow.
- There is no expand/full-screen mode for the notes area.

## Proposed Changes

### 1. Expand toggle in SermonNoteFormDialog
- Add a `Maximize2` / `Minimize2` toggle button near the Notes label in `SermonNoteFormDialog.jsx`.
- Track an `expanded` state in the dialog.
- When expanded:
  - Increase the dialog width class (e.g., `max-w-5xl` or `max-w-7xl`) and use most of the viewport height.
  - Remove the `max-h-[92vh]`/scroll behavior on the dialog content wrapper so the editor itself can claim the extra space.
- When collapsed:
  - Restore the existing `max-w-2xl` and `max-h-[92vh]` layout.

### 2. Responsive editor height
- In `SermonRichEditor.jsx`, pass through an optional `expanded` prop.
- When expanded, set the editor container height to `h-[60vh]` (or `flex-1` with a min-height) and remove the `max-h-[400px]` cap.
- Keep the current `max-h-[400px]` cap for the default view.
- Use flex layout so the editor surface fills the available dialog height without overflowing the viewport; keep the toolbar sticky at the top.

### 3. Persist values across toggle
- Ensure the form state (`title`, `speaker`, `category`, `serviceDate`, `content`, `folderId`) is not reset when toggling expand mode.
- The toggle should only change the dialog size, not the form lifecycle.

## Outcome
Users can click an expand button in the Sermon Notes form to make the notes editor much larger, then click again to return to the compact view. No data is lost during the toggle.
