# Editable transcription preview

After "Convert to text" returns, show the transcribed text in an editable Textarea inside the same HandwritingPad dialog so you can fix any recognition mistakes before it goes into your sermon note.

## Flow

1. Tap **Pen** in the editor toolbar — handwriting pad opens (unchanged).
2. Write, tap **Convert to text** — same edge function call as today.
3. Instead of inserting immediately, the pad swaps to a **Review** view:
   - Multi-line Textarea pre-filled with the transcribed text, auto-focused, cursor at end.
   - Helper line: "Edit anything that was misread, then insert."
   - Buttons: **Back to pad** (returns to canvas with strokes intact so you can rewrite), **Cancel**, **Insert into note**.
4. **Insert into note** sends the (possibly edited) text up via the existing `onConvert(text)` callback — `SermonRichEditor` already splits on newlines into `<p>` tags, so corrections including line breaks are preserved.

## Files to change

- `src/components/sermons/HandwritingPad.jsx` — add `view` state (`"pad" | "review"`) and `draftText` state. On successful transcribe, set `draftText` and switch to `"review"` instead of calling `onConvert` + closing. Render a Textarea + the new buttons when `view === "review"`. Reset both on dialog open.

No changes to `SermonRichEditor.jsx`, the edge function, or any DB.

## Notes

- Strokes stay on the canvas while you're in Review, so "Back to pad" returns you to exactly what you drew — handy when the AI mangled half a word and you want to rewrite just that part rather than typing it.
- Empty-after-edit is blocked the same way empty transcription is today (toast: "Write something first.").
