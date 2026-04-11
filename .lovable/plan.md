

## Update Landing Page

### Changes to `src/pages/LandingPage.jsx`

**1. Make Sign In button more visible**
- Navbar: Change Sign In from `variant="ghost"` to `variant="outline"` with a visible border
- Hero: Style the Sign In button with a solid white background and dark text instead of the current transparent outline

**2. Add all features to the feature grid**
Add the missing modules to match the full feature set (currently 10, expanding to 14):
- SMS Messaging — "Send targeted SMS messages to members and groups"
- Home Cell Fellowship — "Manage home cell centres, leaders, and attendance"
- Church Attendance — "Track Sunday service attendance with detailed records"
- Sermon Notes — "Create, share, and manage sermon notes and resources"

**3. Remove pricing section**
- Delete the entire `pricingTiers` array and the pricing `<section>` block
- Remove the "Pricing" link from the navbar
- Remove the unused `Check` icon import

### Files changed
- `src/pages/LandingPage.jsx` — single file edit

