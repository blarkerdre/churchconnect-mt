

## Dashboard Banner Slideshow Feature

### Overview
Add a configurable image banner carousel that auto-scrolls at the top of the dashboard. Admins can upload multiple banner images via Settings. All users see a smooth auto-playing slideshow.

### Data Model
Use `app_settings` with key `dashboard_banners`. Value is a JSON array:
```json
[
  { "image_url": "https://...", "link_url": "https://...", "alt_text": "..." },
  { "image_url": "https://...", "link_url": null, "alt_text": "..." }
]
```
No migration needed — reuses existing `app_settings` table and `church-documents` storage bucket.

### Implementation

#### 1. `DashboardBannerSettings.jsx` (new)
Admin UI in Settings to manage banner slides:
- Upload multiple images to `church-documents/{tenant_id}/banners/`
- Set optional link URL and alt text per slide
- Reorder, add, and remove slides
- Preview the slideshow

#### 2. `DashboardBanner.jsx` (new)
Display component using Embla Carousel (already installed via the existing `carousel.jsx` UI component):
- Fetches `dashboard_banners` from `app_settings`
- Auto-plays with configurable interval (~5s)
- Full-width, rounded, responsive aspect ratio
- Dot indicators for current slide
- Each slide optionally wraps in a link
- Hides if no banners configured or array is empty

#### 3. Wire into dashboards
- `Dashboard.jsx` — render `<DashboardBanner />` above the stats grid
- `MemberDashboard.jsx` — render `<DashboardBanner />` above the welcome card

#### 4. Wire into Settings
- `Settings.jsx` — add `<DashboardBannerSettings />` section

### Files changed
- **New**: `src/components/dashboard/DashboardBanner.jsx`
- **New**: `src/components/settings/DashboardBannerSettings.jsx`
- **Edit**: `src/pages/Dashboard.jsx` — add banner above stats
- **Edit**: `src/components/dashboard/MemberDashboard.jsx` — add banner above welcome card
- **Edit**: `src/pages/Settings.jsx` — add banner settings section

