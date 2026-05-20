# Why the name isn't visible on the background image

In `supabase/functions/issue-certificate/index.ts`, when a background image is used the name is drawn like this:

```xml
<text ... fill="${bgColor}">{memberName}</text>
```

`bgColor` defaults to `#1a2d4d` (dark navy) and comes from the template's `background_color` — the same field used as the SVG fallback when there is no image. So the text colour is being set to the navy fallback colour, which:

- Is invisible (or barely visible) on a dark/navy background image
- Cannot currently be overridden — `CertificateTemplateSettings.jsx` exposes only `background_color`, `accent_color`, name/title/positions; there is no separate "text colour on image" field

Secondary contributors:
- `name_y` (default 280) may not line up with the engraved "name line" on a custom artwork
- No outline/stroke, so even a slightly busy area swallows the text
- Fonts load from a CDN; if that fetch fails on a cold start, resvg falls back and text can render with zero glyph width (rare, but logs would show `Font fetch failed`)

# Fix plan

1. **Add a `text_color` field to certificate templates**
   - DB migration: `alter table certificate_templates add column text_color text default '#1a2d4d';`
   - `CertificateTemplateSettings.jsx`: add a colour picker beside `background_color`, default `#1a2d4d`, persist via existing save path
   - Live preview already uses `bgColor` for text — switch the preview's name/training/signatory `fill` to `text_color`

2. **Use `text_color` in the edge function (image branch only)**
   - In `issue-certificate/index.ts`, read `template?.text_color || '#1a2d4d'`
   - In the `if (backgroundImageUrl)` SVG block, replace `fill="${bgColor}"` on the name / training / signatory `<text>` elements with `fill="${textColor}"`
   - Leave the no-image SVG branch unchanged (it draws on a white inner panel where navy already reads well)

3. **Add a subtle stroke for legibility on photographic backgrounds**
   - On the name `<text>` only, add `stroke="rgba(255,255,255,0.35)" stroke-width="0.6" paint-order="stroke"` so the name remains readable on busy areas without looking outlined
   - Keep stroke very light so it disappears on plain backgrounds

4. **Log + verify**
   - After deploy, issue a test certificate with the existing background image and confirm the name renders in the chosen colour
   - Check `Font fetch failed` warnings in the edge function logs to rule out the font-loading failure mode

# Out of scope

- No change to position fields, signatory layout, or default SVG (no-image) design
- No change to client download flow or storage paths

# Quick workaround (no code change)

If the user just wants the name visible right now: open the template in Settings, change `Background Color` to a light colour (e.g. `#ffffff` or `#f5f0e0`) — that is the same field currently used for text fill on top of the image. The "background colour" name is misleading; it doubles as the on-image text colour.
