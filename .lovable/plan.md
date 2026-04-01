## Fix Landing Page CTAs + Auth Runtime Error

### Changes

**1. `src/pages/LandingPage.jsx**` — Update all CTA links:

- **"Sign In"** buttons (navbar + hero) → `/auth` (already correct, keep as-is)
- **"Get Started Free"** (hero) → `/onboard`
- **"Start Free Trial"** (Starter & Growth pricing) → `/onboard`
- **"Get Started Free"** (Free tier pricing) → `/onboard`
- **"Contact Us"** (Enterprise pricing) → `mailto:info@churchmanagementsuite.org` instead of a route link

**2. `src/pages/Auth.jsx**` — Fix runtime error: `logoUrl is not defined` on line 173. The previous edit removed the variable but left a reference. Remove or guard the remaining `logoUrl` usage.

### Summary of link mapping


| Button                  | Current target        | New target                              |
| ----------------------- | --------------------- | --------------------------------------- |
| Navbar "Sign In"        | `/t/wci-cardiff/auth` | `/auth`                                 |
| Navbar "Get Started"    | `/t/wci-cardiff/auth` | `/onboard`                              |
| Hero "Get Started Free" | `/t/wci-cardiff/auth` | `/onboard`                              |
| Hero "Sign In"          | `/t/wci-cardiff/auth` | `/auth`                                 |
| Free tier CTA           | `/t/wci-cardiff/auth` | `/onboard`                              |
| Starter tier CTA        | `/t/wci-cardiff/auth` | `/onboard`                              |
| Growth tier CTA         | `/t/wci-cardiff/auth` | `/onboard`                              |
| Enterprise "Contact Us" | `/t/wci-cardiff/auth` | `mailto:info@churchmanagementsuite.org` |


### Files changed

- `src/pages/LandingPage.jsx` — update CTA destinations
- `src/pages/Auth.jsx` — fix `logoUrl` runtime error