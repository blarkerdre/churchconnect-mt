## Create Public Landing Page

### Overview

Create a marketing landing page at `/` for unauthenticated users, with hero section, features showcase, pricing tiers, and CTAs to sign up/log in. Authenticated users bypass it and go straight to their dashboard.

### Approach

**1. `src/pages/LandingPage.jsx**` — New page with these sections:

- **Hero** — Navy-to-dark gradient background, logo, tagline ("All-in-One Church Management Platform"), two CTAs: "Get Started" → `/auth` (signup mode), "Sign In" → `/auth`
- **Features grid** — 8-10 feature cards (Members, Attendance, Events, Follow-ups, Pastoral Care, Communications, Analytics, Transportation) using lucide icons, navy/gold palette
- **Pricing** — 4 tiers (Free, Starter, Growth, Enterprise) matching existing tenant plan tiers, with feature bullets and CTA buttons
- **Footer** — Logo, copyright, links

Design uses the existing navy (`hsl(215,53%,24%)`) and gold (`hsl(42,68%,54%)`) palette, Playfair Display headings, Source Sans 3 body text — matching the Presentation page style.

**2. `src/App.jsx**` — Update routing:

- Add a new route `<Route path="/" element={<LandingPage />} />` in `AppRoutes` for unauthenticated users
- Wrap it so authenticated users redirect to their tenant dashboard
- Keep existing `/t/:tenantSlug/auth` routes unchanged

### Files changed

- `src/pages/LandingPage.jsx` — new landing page component
- `src/App.jsx` — add landing page route for unauthenticated visitors