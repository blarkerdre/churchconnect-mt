Regenerate `/mnt/documents/children-church-guide.png` as a single-page A4 poster (2480×3508, 300dpi) with bolder typography and two clear process flows side-by-side.

## Layout (single page)
- **Header**: Navy band, oversized Playfair Display Black title "Children's Church — Drop-off & Pickup", gold underline bar, subtitle.
- **Two-column process flows** (the main change):
  - **Left column — Parent / Guardian**
    1. Before Sunday — open *My Family*, confirm child profile, add **Authorised Pickup Adults**, generate **One-time Pickup Code** for one-off pickups.
    2. At Drop-off — bring child to Children's Church desk, receive in-app + email + SMS confirmation with **4-digit Pickup PIN**.
    3. At Pickup — show PIN at desk; if someone else collects, they show the One-time Code + photo ID.
    4. Lost PIN — speak to a leader for re-issue.
  - **Right column — Children's Church Worker**
    1. Check-in — verify child against family record, tag child, trigger PIN dispatch to parent.
    2. During service — supervise, log incidents/medical notes in app.
    3. Pickup — verify PIN against record; for non-parent, verify One-time Code + photo ID against Authorised Adults list.
    4. Release — mark child **Checked Out** in app; use **Leader Override** only in emergencies (auto-logged).
- **Bottom band — Safety Notes** (full-width gold strip): authorised adults only · overrides logged · PIN private.
- **Footer**: "WCI Cardiff · Children's Church".

## Bolder visual treatment
- Gold-filled square step badges with navy numerals (replacing thin circles).
- Section headings in Playfair Display Black, larger size.
- Body in Source Sans 3 SemiBold.
- Thick gold dividers, navy column headers ("PARENT" / "WORKER") in cream uppercase tracking.

## Technical
- Python + Pillow, reuse `/tmp/fonts/`; download Playfair Display Black weight if missing.
- Overwrite `/mnt/documents/children-church-guide.png`.
- QA: open the rendered PNG, verify both columns fit with margins, no clipping/overlap, regenerate if issues. Surface via `<presentation-artifact>`.
