# Why the issued certificate is a plain blue file

The PNG produced by `issue-certificate` falls back to a blank navy rectangle for two independent reasons in the same edge function. Both must be fixed.

## Root causes

1. **Background image silently fails to embed.**
   The function fetches the signed URL of the uploaded background, then converts the bytes with:
   ```ts
   btoa(String.fromCharCode(...new Uint8Array(imgBuf)))
   ```
   The spread operator pushes every byte onto the JS call stack. For the 160 KB sample JPG (and any reasonably-sized upload) this throws `RangeError: Maximum call stack size exceeded` in Deno. The `try/catch` around it swallows the error, leaves `bgDataUri = ""`, and the SVG falls back to a single `<rect fill="#1a2d4d"/>` — no border, no decoration, just navy. That is the "plain blue" you see.

2. **resvg renders no text because no fonts are loaded.**
   The renderer is created with `loadSystemFonts: false` and only `defaultFontFamily: "serif"`. The SVG's `@import url('https://fonts.googleapis.com/css2?...')` is **not** fetched by resvg-wasm — it ignores `<style>` font imports. With no font buffers supplied, every `<text>` glyph is dropped. So even when the background does load, the name / training type / date / cert number never appear.

Combined effect: a navy rectangle with nothing on it.

## Fix

Edit only `supabase/functions/issue-certificate/index.ts`.

1. **Replace the base64 conversion** with Deno std's chunk-safe encoder:
   ```ts
   import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
   // ...
   const base64 = encodeBase64(new Uint8Array(imgBuf));
   ```
   Also log a warning when every candidate path fails so future issues surface in edge function logs instead of being silent.

2. **Load real font buffers into resvg.** Fetch Playfair Display 700 and Inter 400/600 TTFs from a stable CDN (jsDelivr `@fontsource/...`) once per cold start, cache them at module scope, and pass them via the resvg constructor:
   ```ts
   const resvg = new Resvg(svg, {
     background: "rgba(255,255,255,1)",
     fitTo: { mode: "width", value: 1684 },
     font: {
       loadSystemFonts: false,
       fontBuffers: [playfairBold, interRegular, interSemibold],
       defaultFontFamily: "Inter",
       serifFamily: "Playfair Display",
       sansSerifFamily: "Inter",
     },
   });
   ```
   Font fetch failures are non-fatal: render proceeds with whatever loaded, and we log a warning.

3. **Remove the now-useless `@import` Google Fonts `<style>` block** from both SVG branches so resvg doesn't waste time on it. Keep `font-family` attributes — they will resolve against the loaded buffers.

4. **Log clearly** when `bgDataUri` ends up empty after trying both candidate paths, so a future broken upload is obvious in logs.

## Out of scope

- No DB schema changes.
- No changes to `CertificateTemplateSettings.jsx`, `MyCertificates.jsx`, or the sample asset itself.
- Not regenerating already-issued blue certificates — fix forward; user can reissue after this lands.

## Verification

After deploy, in the preview:
1. Open Certificate Templates → confirm "Use Sample" is still applied to the Default template.
2. Issue a fresh certificate to a test member.
3. Download from My Certificates → the PNG should now show the navy/gold sample background **plus** the member name, training, date, certificate number, and signatory.
4. Check edge function logs — no `bgDataUri` warnings, no font warnings.
