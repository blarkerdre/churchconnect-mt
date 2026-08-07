# Presentation Page Refresh

Update `/presentation` so it reflects the app as it exists today, fits any screen properly, and is branded neutrally for demos.

## Branding

- Replace the Winners Chapel logo with the ChurchConnect logo (`/lovable-uploads/church-connect-logo-transparent.png`).
- Title slide badge reads **Demo Church** instead of "Winners Chapel International Cardiff".
- Add a persistent footer line on every slide: **Powered by DomiFort Solutions Limited**, plus a closing line on the final slide.

## Content update (feature slides)

Keep the existing strong slides and refresh/extend them to match current features:

1. Title — Demo Church branding
2. Why ChurchConnect (challenge, solution, mobile-first, secure)
3. Smart dashboards (admin, unit/home cell leader, member)
4. Member management (profiles, QR registration, milestones, status lifecycle, family)
5. Events & attendance (events, self check-in, session types, downloadable rosters)
6. Follow-ups & sign-posting
7. Pastoral care
8. Communications (announcements, email, SMS/WhatsApp, in-app notifications, push)
9. Bible School (applications, registrations, sessions/editions, exams, QC checks, certificates, final course report)
10. Children & Teens Church (secure check-in/out, PIN pickup, parental consent, QR codes)
11. Home Cell centres
12. Transportation
13. Analytics & reports (trends, absence alerts, milestone & conversion reports, reports officer role)
14. Security & administration (RBAC, 2FA, audit logs, GDPR, multi-tenancy)
15. Closing — Powered by DomiFort Solutions Limited

## Fit-to-screen

Current slides overflow on phones and short laptops. Fixes:

- Give each slide a scrollable, padded container (`h-full overflow-y-auto`) with centered content when it fits.
- Scale typography responsively: headings `text-2xl sm:text-4xl md:text-5xl`, body `text-xs sm:text-sm`.
- Tighten paddings/gaps on small screens (`p-4 sm:p-6`, `gap-3 sm:gap-6`).
- Grids collapse to 1 column on mobile, 2 on tablet, 3 on desktop; the pastoral-care chip grid becomes 2 columns on mobile.
- Reduce logo/icon sizes at small breakpoints so the title slide never clips.
- Keep tap-to-advance but make sure it doesn't fight scrolling on mobile (advance via the control bar arrows/dots; taps on the slide body still advance on desktop widths).

## Technical

Single file change: `src/pages/Presentation.jsx`. Extract a small `SlideShell` wrapper (title, icon, footer, scroll container) so all slides share consistent spacing, and convert the slide array to use it. No backend or data changes.
