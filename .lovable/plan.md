# Children's Church Drop-off & Pickup Guide (PNG)

A single, print-ready PNG poster (1600×2000) saved to `/mnt/documents/children-church-guide.png`, in the project's navy & gold brand palette with Playfair Display headings and Source Sans 3 body.

## Content

**Title:** Children's Church — Drop-off & Pickup Guide
**Subtitle:** Keeping every child safe, every Sunday

### Section 1 — Before You Arrive
1. Open *My Family* in the app and confirm your child's profile (allergies, age group, medical notes).
2. Add **Authorised Pickup Adults** — only people on this list can collect your child.
3. For one-off pickups (grandparent, family friend), generate a **One-time Pickup Code** valid for that day.

### Section 2 — Drop-off
1. Bring your child to the Children's Church desk.
2. A worker checks your child in — you'll receive an **in-app, email and SMS** confirmation with a **Pickup PIN**.
3. Keep the Pickup PIN private. You'll need it (or photo ID) at collection.

### Section 3 — Pickup
1. Return to the Children's Church desk after service.
2. Show your **4-digit Pickup PIN** to the worker.
3. If someone else is collecting, they must show the **One-time Code** you generated, plus photo ID.
4. The worker releases the child and marks them **Checked Out** in the app.

### Section 4 — Safety Notes
- Children are only released to authorised adults or valid one-time codes.
- A leader can override in emergencies; every override is logged.
- Lost your PIN? Speak to a Children's Church leader — they can re-issue.

## Technical

- Use Python + Pillow to compose the poster.
- Brand: navy `#0B1F3A` background blocks, gold `#C9A24B` accents, cream `#F7F3EA` body areas.
- Headings: Playfair Display (download via Google Fonts to /tmp); body: Source Sans 3.
- Numbered gold circles for each step, generous spacing, footer line: "WCI Cardiff · Children's Church".
- QA: open the rendered PNG, verify no overflow/overlap, regenerate if issues.
- Output: `/mnt/documents/children-church-guide.png`, surfaced via `<presentation-artifact>`.
