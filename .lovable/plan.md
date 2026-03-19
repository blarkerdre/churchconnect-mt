

# PowerPoint Presentation for MyChurchConnect App

## What We'll Build

A new `/presentation` page in the app that renders a fullscreen, navigable slide deck showcasing the app's features. Each slide will include a visual mockup/illustration of the relevant feature area, styled to look like a professional pitch deck. A download-as-PDF option will be included via the browser's print functionality.

Since we can't take live screenshots programmatically, each slide will feature styled **feature cards with icons and descriptions** that visually represent each module, plus the app's actual logo and branding.

## Slide Deck Content (12 slides)

1. **Title Slide** — "MyChurchConnect" logo, tagline: "A Complete Church Management Platform", Winners Chapel International Cardiff branding
2. **Overview** — Problem statement and solution summary
3. **Dashboard** — Role-based dashboards (Admin, WSF Leader, Member), stat cards, growth indices
4. **Member Management** — Registration, profiles, growth milestones tracking, QR code registration
5. **Events & Attendance** — Event creation, self check-in, session-based attendance tracking
6. **Follow-ups** — Auto-assignment for first timers/new converts, notifications (email + SMS)
7. **Pastoral Care** — Care requests, case assignment to unit members, notifications
8. **Communications** — Announcements, email alerts, SMS messaging with Twilio
9. **Transportation** — Ride booking and management
10. **WSF Centres** — Winners Satellite Fellowship management, attendance tracking
11. **Analytics & Reports** — Attendance trends, absence alerts, member consistency, training reports
12. **Security & Admin** — Role-based access control, audit logging, user management, RLS policies

## Technical Approach

- **New file**: `src/pages/Presentation.jsx` — standalone fullscreen slide viewer
- **Route**: Add `/presentation` as a public route (no auth required) in `App.jsx`
- **Navigation**: Arrow keys + click navigation, slide counter, fullscreen toggle
- **Styling**: Gradient backgrounds per slide, large icons from lucide-react, church branding colors
- **Print/Export**: A "Download PDF" button triggers `window.print()` with print-optimized CSS
- **No external dependencies** — uses existing UI components and icons

## Files to Create/Edit

| File | Action |
|------|--------|
| `src/pages/Presentation.jsx` | Create — full slide deck component |
| `src/App.jsx` | Edit — add `/presentation` public route |

