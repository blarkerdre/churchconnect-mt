## Problem

In `src/components/dashboard/DashboardBanner.jsx`, each banner image is rendered as:

```jsx
<img className="w-full object-cover rounded-xl" style={{ height }} />
```

- `w-full` stretches the image to the full carousel width (which on desktop/tablet can be 900–1200px+).
- `height` is a fixed pixel value from settings (default 200px).
- `object-cover` then crops the image to fill that wide-but-short box.

Result: on phones (~360px wide × 200px tall ≈ 1.8:1) the image looks roughly correct, but on tablet/desktop the container becomes very wide with the same fixed height (e.g. 1200×200 = 6:1), so images appear stretched/cropped and lose their natural proportion. The same fixed-height issue applies to the "Book of the Month" slide via `minHeight`.

The uploaded asset itself is fine — it's the container's aspect ratio that changes with viewport while height stays constant.

## Fix

Make the slide container preserve a sensible aspect ratio across breakpoints instead of locking to a fixed pixel height, and let images render to their natural proportions.

### Options to choose from

1. **Aspect-ratio container (recommended)** — Wrap each slide in an `AspectRatio` (e.g. 21:9 on desktop, 16:9 on tablet, 2:1 on mobile) and keep `object-cover`. Image always fills correctly and scales proportionally with width. The "height" slider in settings becomes a max-height cap rather than a forced height.

2. **`object-contain` with neutral background** — Keep the configurable height but switch to `object-contain` so the full image is always visible (letterboxed on wide screens). No cropping, but adds bars on the sides.

3. **Responsive heights** — Keep `object-cover` but use Tailwind responsive heights (e.g. `h-48 sm:h-64 md:h-80 lg:h-96`) so taller containers on bigger screens reduce the extreme width:height ratio. Simplest change, still crops a bit.

### Files to change

- `src/components/dashboard/DashboardBanner.jsx` — update `BannerSlide` and `BookSlide` containers.
- Optionally `src/components/settings/DashboardBannerSettings.jsx` — relabel the height slider (e.g. "Max height" or remove if option 1 is chosen).

Please pick option 1, 2, or 3 (or describe the look you want) and I'll implement it.
