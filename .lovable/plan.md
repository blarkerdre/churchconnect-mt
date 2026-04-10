

## Merge Books of the Month into Banner Slideshow

### Overview
Combine the separate "Book of the Month" card and "Dashboard Banner" slideshow into a single unified carousel. Admins can add two types of slides: **image banners** (existing) and **book promotions** (with title, author, cover image, purchase link). Both slide types rotate together in the same auto-playing carousel.

### Data Model Change
Extend the `dashboard_banners` JSON array in `app_settings` to support a `type` field:

```json
[
  { "type": "banner", "image_url": "...", "link_url": "...", "alt_text": "..." },
  { "type": "book", "image_url": "...", "title": "Book Title", "author": "Author Name", "description": "...", "purchase_url": "https://..." }
]
```

No migration needed — same `app_settings` key, just richer JSON.

### Implementation

#### 1. Merge settings UI — `DashboardBannerSettings.jsx`
- Rename section to "Dashboard Slideshow"
- Add a slide type picker when adding a new slide: **Image Banner** or **Book Promotion**
- Image Banner slides: same as today (image upload, link URL, alt text)
- Book Promotion slides: cover image upload, title, author, description, purchase URL
- Both types appear in the same ordered list with drag/reorder

#### 2. Update `DashboardBanner.jsx` carousel
- Render two slide layouts based on `type`:
  - `banner`: full-width image (existing behavior)
  - `book`: split layout with cover image on left, title/author/description + "Buy Now" button on right, styled attractively
- Keep auto-play, dot indicators, responsive sizing

#### 3. Remove standalone components
- Remove `BookOfTheMonth.jsx` component
- Remove `BookOfTheMonthSettings.jsx` component
- Remove `<BookOfTheMonth />` from `MemberDashboard.jsx`
- Remove the "Books" tab from `Settings.jsx`
- The `books_of_the_month` table remains (no data deletion) but is no longer queried

### Files changed
- **Edit**: `src/components/dashboard/DashboardBanner.jsx` — add book slide rendering
- **Edit**: `src/components/settings/DashboardBannerSettings.jsx` — add book slide type with fields
- **Edit**: `src/components/dashboard/MemberDashboard.jsx` — remove `<BookOfTheMonth />`
- **Edit**: `src/pages/Settings.jsx` — remove Books tab and BookOfTheMonthSettings import
- **Delete**: `src/components/dashboard/BookOfTheMonth.jsx`
- **Delete**: `src/components/settings/BookOfTheMonthSettings.jsx`

