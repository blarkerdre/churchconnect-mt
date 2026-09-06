# OC1 Evidence Pack — Concise 3-Page Edition

Re-export the Optional Criterion 1 pack as a tight 3-page document that keeps all four
innovations, the live traction figures, and the ownership/authorship evidence. The existing
8-page version stays untouched as the expanded reference copy.

## New file

`Global-Talent-OC1-Innovation-3page.docx` (the 8-page file remains available).

## Page layout

**Page 1 — Claim, scale, and the four innovations (summary)**
- One-paragraph statement of the OC1 claim (innovation as a founder/employee in digital technology).
- Verified scale strip: the nine production metrics in a compact two-row table (no chart).
- Four innovations listed as a four-row table: innovation name, what is novel, repository path
  and line reference. This is the at-a-glance map for the assessor.

**Page 2 — Evidence screenshots**
- The four existing GitHub screenshots (multi-church isolation, safeguarding custody state
  machine, IP-free analytics, self-healing loader) placed in a 2x2 grid.
- Each keeps its repository breadcrumb and visible line numbers; each gets a one-line italic
  caption with repo path and line range (Figures 1-4).

**Page 3 — Traction and ownership**
- 90-day usage figures: 4,394 visitors, 21,500 page views, 4.89 views per visit, ~6m 54s average
  duration, 36% bounce — stated as a short table with the measurement window and source.
- Tenant/member scale line (churches, members, sign-in accounts).
- Ownership: the cropped GitHub profile capture showing full name and contribution activity,
  plus the repository URL and a one-line authorship statement (Figure 5).

## What gets cut (content preserved, prose compressed)

- Long narrative sections per innovation collapse into the page-1 table plus caption text.
- The Figure 1 scale chart is dropped; the numbers stay in table form.
- The standalone appendix traceability index is folded into the page-1 innovation table
  (path + line columns), so every claim still traces to source.

## Technical notes

- Generated with the same `docx` script pipeline used for the 8-page pack, US Letter, 1in
  margins, Arial base, existing heading styles.
- Images reused from the already-cropped figures; scaled to fit the 2x2 grid at full content
  width without distortion (aspect ratio preserved).
- Captions: italic 9pt, colour `5A6270`, centred.
- Output written to `/mnt/documents/`, then rendered to PDF and every page inspected as an image
  before delivery to confirm exactly three pages, no clipped text, no overflowing images.
