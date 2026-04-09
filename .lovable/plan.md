

## Enlarge Book Covers and Profile Picture on Click (Lightbox)

### Approach
Add a simple image lightbox using a Dialog overlay. When a user taps the book cover image or their profile photo in the welcome banner, a fullscreen overlay shows the image at its natural size.

### Changes

#### 1. Create `src/components/ui/ImageLightbox.jsx`
A reusable component that wraps any clickable image. Uses Radix Dialog (already installed) to show a centered, fullscreen overlay with the enlarged image. Tap backdrop or X to close.

#### 2. `src/components/dashboard/BookOfTheMonth.jsx`
- Import `ImageLightbox`
- Wrap each book cover `<img>` so clicking it opens the lightbox with the full `cover_image_url`
- Add `cursor-pointer` to the thumbnail

#### 3. `src/components/dashboard/MemberDashboard.jsx`
- Import `ImageLightbox`
- Wrap the profile photo `<img>` (line 42) so clicking opens the lightbox with `myMember.photo_url`
- Add `cursor-pointer` to the avatar container (only when photo exists)

### Files changed
- **New**: `src/components/ui/ImageLightbox.jsx`
- `src/components/dashboard/BookOfTheMonth.jsx` — clickable book covers
- `src/components/dashboard/MemberDashboard.jsx` — clickable profile photo

