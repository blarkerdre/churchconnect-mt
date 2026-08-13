# Fix: keyboard closes while typing in Sermon Notes

## What's happening

In the sermon note dialog, the block of detail fields (Title, Speaker, Category, Folder, Service date) is defined as a component *inside* the dialog component (`MetadataFields` in `src/components/sermons/SermonNoteFormDialog.jsx`, line 226). React treats it as a brand-new component type on every keystroke, so the whole block is destroyed and rebuilt each time a character is typed. The input loses focus, and on phones/tablets the on-screen keypad closes and re-opens — exactly the instability reported.

The notes editor itself (TipTap) is a separate, stable component, so this affects the detail fields, and the flicker also disturbs the surrounding layout.

## The fix

- Move the detail fields out of the render body: define them once as a real component (either a top-level component in the same file or a small `src/components/sermons/SermonNoteMetaFields.jsx`) that receives the current values and change handlers as props.
- Render that component in the three places it is used today (compact view, and the expanded/fullscreen "Edit details" panel) instead of calling the inline arrow function.
- No behaviour, wording, layout, or styling changes — the fields, folder-creation inline flow, and validation stay identical.

## Verification

- Type continuously into Title/Speaker/Category on desktop and at a mobile viewport; focus must stay in the field and the keypad must remain open.
- Confirm folder create/cancel, date picker, draft autosave status, expand/fullscreen toggles, and save all still behave as before.
