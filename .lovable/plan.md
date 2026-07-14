## Plan

1. **Fix the preview image source**
   - The backend returns raw PNG base64 in `image_base64`, but the frontend currently uses it directly as `<img src>`, so the browser does not treat it as an image URL.
   - Update the certificate preview to prefix returned base64 with `data:image/png;base64,` when needed.

2. **Make preview loading resilient**
   - Ensure the preview state always clears `loading` after a successful response.
   - Keep support for future responses that might already return a full `data:image/...` URL.

3. **Add a clear fallback error**
   - If the preview response succeeds but contains no image payload, show a visible error instead of leaving the preview area in a loading/blank state.

4. **Verify the flow**
   - Re-open **Exam Management → Preview & Send… → Certificate** and confirm the certificate image renders instead of spinning.