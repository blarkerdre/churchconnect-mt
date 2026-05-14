# Comprehensive Church Management Suite User Guide

A single branded PDF (~30 pages) covering every core feature in detail, with illustrative UI mockups (drawn with reportlab — navy/gold DomiFort branding, no live login required).

## Structure

**Front matter**
- Cover (DomiFort branding, "Comprehensive User Guide", version, date)
- Table of contents
- How to use this guide / role legend (Member · Leader · Admin)

**Part 1 — Getting Started** (all roles)
1. Signing in & tenant URL
2. Installing the app (PWA on iOS / Android / Desktop)
3. Completing your profile & privacy consent
4. Navigation tour (sidebar, mobile bottom nav, notification bell)
5. Switching tenants & signing out

**Part 2 — For Members**
6. Dashboard & feed (banners, Book of the Month, reactions)
7. My Profile (photo, contact, family, preferences)
8. Events — browsing, registering, reminders
9. Self check-in for services
10. Sermon Notes (TipTap editor)
11. Requesting Pastoral Care (confidential prayer/counselling)
12. Booking Transportation
13. Submitting a Testimony
14. Bible School registration (WoFBI flow)
15. My Certificates
16. Birthdays & in-app notifications
17. Giving feedback / unsubscribing

**Part 3 — For Leaders** (Unit Leaders, Home Cell Leaders, Pastoral Leaders)
18. Leader dashboard overview
19. Unit attendance & demographic breakdown
20. Home Cell management (centre members, attendance, sign-post inbox)
21. Pastoral Care queue (assignments, status, history, confidentiality)
22. Follow-ups & referrals (contact preferences, progress updates)
23. Transportation assignments
24. Sending messages to your group (in-app / email / SMS / WhatsApp)

**Part 4 — For Administrators**
25. Members directory & bulk import
26. User management & role assignment
27. Communications hub (announcements, email, SMS, WhatsApp, scheduling, quotas)
28. Events & recurrences, audience scoping, reminders
29. Church attendance reporting
30. Analytics — milestone gaps & status conversion reports + messaging filtered members
31. Training reports (BFC/BCC/LCC/LDC)
32. Bible School: courses, sessions, exams, results, certificates
33. Settings: church units, Home Cell centres/zones, banners, external links, consent text, follow-up templates, birthday messages
34. Audit logs & system logs
35. Danger Zone: backup, restore, purge

**Part 5 — Tips, Troubleshooting & Support**
36. Common issues (login, PWA install, notifications, SMS not received)
37. Privacy, GDPR & UK data residency
38. Getting help (contact DomiFort Solutions)

## Visual approach

- **Branding:** Navy `#0B1B3A`, gold `#C9A24C`, Playfair-style display + clean sans body, DomiFort cover and footer on every page.
- **Mockups:** Each section gets 1–2 simplified UI mockups drawn with reportlab shapes (sidebar + content frame + sample cards / table / dialog) — clearly labelled "Illustrative example". No real screenshots since you chose mockups.
- **Step blocks:** Numbered steps with bold action verbs, info callouts (tips, warnings, admin-only badges), and role chips at the top of each chapter.
- **Page furniture:** Running header (chapter), footer with page number and "DomiFort Solutions Limited · Comprehensive User Guide".

## Technical notes

- Built with `reportlab` (`SimpleDocTemplate` + custom `Flowable` mockups + `onLaterPages` header/footer).
- Output: `/mnt/documents/ChurchManagementSuite_UserGuide_Comprehensive.pdf`.
- QA: render every page to JPEG at 110 DPI, scan for overflow / overlap / missing mockups, fix and re-render until clean. Will report issues found.
- Estimated length 28–34 pages.

Approve to build.
