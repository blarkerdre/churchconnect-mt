# Trustpilot Reviews on the Public Site

Show real customer feedback as social proof, plus a clear way for users to leave a review.

## What gets built

1. **Reviews section on the landing page** — a "What churches say about us" block between Features and the Footer: overall star rating, review count, and a responsive grid of review cards (stars, title, quote, reviewer first name, date), with a "Read all reviews on Trustpilot" link.
2. **Compact rating badge** — star rating + count shown in the landing hero and repeated on the Trust page (Trust & Privacy), linking out to the Trustpilot profile.
3. **"Leave a review" prompt in-app** — an entry in the existing feedback area of the dashboard sidebar that opens the Trustpilot review link in a new tab, shown alongside the current in-app feedback option.

## Where the reviews come from

Reviews are stored in the backend so they can be updated without code changes:

- A `trustpilot_reviews` table (platform-wide, not tenant-scoped) holding stars, title, body, reviewer display name, review date, and a display order / published flag.
- Public read access for published reviews; only super admins can add, edit, or remove entries.
- A small management panel in Tenant Admin for super admins to paste in reviews from the Trustpilot dashboard, set the overall score and total review count, and toggle which ones show.

This avoids needing a Trustpilot API key up front. If you later want live auto-syncing from Trustpilot's API, the same table can be filled by a scheduled backend job — the front end won't need changes.

## Configuration

A single settings row holds the Trustpilot profile URL, overall score, and total review count, edited in the same admin panel. Until it's filled in, the reviews section stays hidden so the public site never shows empty or placeholder ratings.

## Technical notes

- New table `public.trustpilot_reviews` + settings key, with explicit GRANTs and RLS: `SELECT` to `anon`/`authenticated` for published rows, write restricted to super admins.
- New components: `src/components/reviews/TrustpilotReviews.jsx` (grid section), `src/components/reviews/TrustpilotBadge.jsx` (compact rating), `src/components/settings/TrustpilotReviewsManager.jsx` (admin CRUD).
- Wired into `src/pages/LandingPage.jsx`, `src/pages/Trust.jsx`, and the Tenant Admin page.
- Review markup includes `AggregateRating` / `Review` JSON-LD on the landing page for search visibility, generated only from stored real reviews.
- No invented reviews, ratings, or counts — the section renders only what an admin has entered.
