
## Goal
Produce a rendered screenshot of the Statement of Result for a real WCI Cardiff Bible School student, so you can eyeball the layout, branding, reference number, and grade formatting end-to-end.

## Current gap
WCI Cardiff has the three Bible School courses (BCC, LCC, LDC) defined, but no exam sessions, no exam subjects, no registrations, and no attempts. Nothing can render until at least one full chain exists.

## Steps

### 1. Seed test data for BCC under WCI Cardiff
All rows tagged `tenant_id = 95e53cc3-… (wci-cardiff)`, marked as test data (name suffixed "(TEST)") so they can be identified and removed later.

- **1 exam session**: "Cardiff Bible School — Sample Session (TEST)"
- **Link session to BCC** via `exam_session_courses`
- **6 exam subjects under BCC** (typical WOFBI module names): Understanding Salvation, Understanding the Church, Understanding the Bible, Understanding the Holy Spirit, Understanding Prayer, Understanding Faith.
- **1 registration**: existing member `Loretta Asare` (fc07ec8a-…) → BCC → the session above. `student_number` left NULL so the auto-generation path is exercised.
- **6 exam attempts** for that member, one per subject, all `completed_at` set, `passed=true`, with a spread of scores producing letter grades A+/A/B/C/D/E (e.g. 92, 85, 74, 66, 55, 48) to visually validate the grade band mapping.

Done via `supabase--insert` (data-only, no schema changes).

### 2. Render and capture
- Launch Playwright headless, restore the injected Supabase session, navigate to the WCI Cardiff Bible School results screen for BCC.
- Open Loretta Asare's Statement of Result dialog, trigger the print preview, and screenshot the on-screen and print-format views at 1280×1800.
- Save PNGs under `/mnt/documents/wci-cardiff-statement-of-result*.png` and surface them as `<presentation-artifact>` tags.

### 3. QA
- Visually verify: Cardiff logo + centre header, "STATEMENT OF RESULT" title, course + session line, name + auto-generated reference number (format `WCI-CARDIFF/BCC/<session>/101`), module table with A+…E letter grades, overall classification row, notes key, signatory block.
- Fix any layout issues (clipping, overflow, missing logo) before delivering.

### 4. Cleanup note
Seeded rows stay in the DB (marked TEST) so you can reuse them. I'll list their IDs at the end so you can delete them any time with one query.

## Out of scope
- No schema changes.
- No template changes — this is purely a rendering sample of the current implementation.
- No email or PDF export delivery — screenshots only.
