# Handwriting → Text for Sermon Notes

Add a "Write with pen" mode to the Sermon Note editor so users can write with a stylus (Apple Pencil, S Pen) or finger, then have the strokes converted to typed text and inserted into the TipTap editor.

## How it will work (user flow)

1. In the **New / Edit Sermon Note** dialog, a new **Pen** button appears in the editor toolbar (next to Bold/Italic).
2. Tapping it opens a **Handwriting pad** overlay:
   - Full-width white canvas sized to the dialog, with smooth pressure-aware strokes.
   - Controls: Pen thickness, Eraser/Undo last stroke, Clear, Cancel, **Convert to text**.
   - Works with finger, Apple Pencil, Samsung S Pen, mouse (uses Pointer Events).
3. **Convert to text** sends the canvas image to an Edge Function that calls Lovable AI (Gemini vision) to transcribe the handwriting.
4. The returned text is inserted at the current cursor position in the TipTap editor. The pad closes. User can keep writing more, or save.

## Components to add / change

- `src/components/sermons/HandwritingPad.jsx` *(new)* — canvas overlay using Pointer Events, stroke smoothing, undo/clear, "Convert" button. Exports a base64 PNG.
- `src/components/sermons/SermonRichEditor.jsx` — add a `Pen` toolbar button that opens `HandwritingPad`; on convert, call `editor.chain().focus().insertContent(text).run()`.
- `supabase/functions/transcribe-handwriting/index.ts` *(new)* — accepts `{ imageBase64 }`, calls Lovable AI Gateway with `google/gemini-2.5-flash` (vision) using a prompt like *"Transcribe the handwriting in this image. Return ONLY the transcribed text, preserving line breaks. If unreadable, return an empty string."* Returns `{ text }`. Uses standard 429/402 handling already used by other AI functions in this repo.

No DB schema changes. No new secrets — `LOVABLE_API_KEY` is already available to Edge Functions.

## Why this approach (vs alternatives)

- **Browser-native handwriting (Apple Scribble / Samsung handwriting keyboard)** works on contentEditable but only on those specific devices, has no Android/desktop story, and gives no visible affordance. We'll still benefit from it on iPadOS automatically — this canvas is for everyone else and for the explicit "pen" experience the user asked for.
- **On-device handwriting recognition libraries** (MyScript, etc.) require paid SDKs/licences. Using Lovable AI keeps it free under the gateway and supports any language Gemini handles, including names of preachers/scripture references.

## Notes / limits

- One page of handwriting at a time (canvas is cleared after insert). For long notes, user writes a paragraph, converts, writes the next.
- Accuracy depends on legibility; we'll show a toast like "Couldn't read that — try writing larger" if the model returns empty text.
- Image is sent only to Lovable AI; nothing stored.
