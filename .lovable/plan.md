

## Add Banner Image Resize Control

### Overview
Allow admins to control the display height of each banner slide via a simple height slider in the settings. The chosen height is saved per-slide and applied in the carousel.

### Data Model Change
Add an optional `height` field to each slide object in the `dashboard_banners` JSON:
```json
{ "type": "banner", "image_url": "...", "height": 200 }
```
No migration needed — just an extra JSON property. Default: 200px for banners, unchanged for books.

### Implementation

#### 1. Settings UI — `DashboardBannerSettings.jsx`
- Import `Slider` from `@/components/ui/slider`
- For each slide, add a "Banner Height" slider (range 100–400px, step 10) below the image upload
- Display the current value in pixels next to the label
- On change, call `updateSlide(i, "height", value)`

#### 2. Carousel display — `DashboardBanner.jsx`
- In `BannerSlide`, replace the fixed `aspect-[21/9]` class with an inline `style={{ height: slide.height || 200 }}` and use `object-cover w-full rounded-xl`
- For `BookSlide`, apply `min-height` from `slide.height` if set, keeping the flex layout intact

### Files changed
- **Edit**: `src/components/settings/DashboardBannerSettings.jsx` — add height slider per slide
- **Edit**: `src/components/dashboard/DashboardBanner.jsx` — use dynamic height from slide data

