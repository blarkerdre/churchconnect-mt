# Make the Settings top bar scrollable

## Changes
- Keep the current labelled section selector on phones.
- Make the Settings section bar horizontally scrollable on tablet and desktop when all sections do not fit.
- Keep every section label on one line and prevent the bar itself from widening the page.
- Show a subtle horizontal scrollbar so users can discover and drag the remaining sections instead of having them clipped.
- Preserve touch/trackpad scrolling and ensure the selected section scrolls into view automatically.

## Validation
- Check the Settings bar at phone, tablet, standard desktop, and wide desktop sizes.
- Confirm the first and last sections are reachable and selecting a section still displays the correct settings.
- Confirm the page has no horizontal overflow outside the section bar.

## Technical details
- Limit changes to the Settings navigation presentation and its selected-tab visibility behavior.
- Reuse the existing tabs, section permissions, design tokens, and phone selector; no feature, permission, or data changes.
