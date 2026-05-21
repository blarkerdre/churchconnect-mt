# Fix: Certificate name not rendered on background image

## Root cause

The edge function logs show every font fetch returning **404**:

```
Font fetch failed: .../@fontsource/playfair-display@5.0.20/.../playfair-display-latin-700-normal.ttf 404
Font fetch failed: .../@fontsource/inter@5.0.18/.../inter-latin-400-normal.ttf 404
... (500, 600, 700 same)
```

I confirmed via curl: `@fontsource` packages on jsDelivr **no longer ship `.ttf` files** in `/files/` — only `.woff2`. So `loadFonts()` returns an empty array, resvg has no fonts available, and every `<text>` element silently renders as nothing.

On the default (no background image) design the SVG still has the decorative rectangles/lines/accent bars, so it *looks* like something was generated. On the background-image design there are **no shapes** — just text — so the output looks like the bare background image with no name. That matches exactly what you're seeing.

## Fix

Switch `loadFonts()` in `supabase/functions/issue-certificate/index.ts` to URLs that actually exist and are TTF (resvg-wasm needs TTF/OTF buffers).

Use the raw font files from the Fontsource GitHub repo via jsDelivr's `gh` endpoint, which still serves `.ttf`:

```
https://cdn.jsdelivr.net/gh/fontsource/font-files/fonts/google/inter/files/inter-latin-400-normal.ttf
https://cdn.jsdelivr.net/gh/fontsource/font-files/fonts/google/inter/files/inter-latin-500-normal.ttf
https://cdn.jsdelivr.net/gh/fontsource/font-files/fonts/google/inter/files/inter-latin-600-normal.ttf
https://cdn.jsdelivr.net/gh/fontsource/font-files/fonts/google/inter/files/inter-latin-700-normal.ttf
https://cdn.jsdelivr.net/gh/fontsource/font-files/fonts/google/playfair-display/files/playfair-display-latin-700-normal.ttf
```

(I'll verify each returns 200 before saving the change, and reset the cached `_fontsPromise` is unnecessary since it's per-cold-start.)

Also add a guard: if `fontBuffers.length === 0`, log a clear error so future regressions are obvious instead of silently producing a blank certificate.

## Files changed

- `supabase/functions/issue-certificate/index.ts` — replace 5 font URLs in `loadFonts()`, add empty-buffer warning.

## Out of scope

No template, schema, UI, layout, or storage changes. The text_color feature added previously stays as-is.

## Verification

After deploy, re-issue a certificate and check the edge function logs — `Font fetch failed` warnings should be gone, and the name should appear on the background image.
