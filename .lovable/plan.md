## Goal
Let students give their testimony a title in the Bible School course feedback form, and use that title as the heading in the Course Final Report.

## Changes

1. `src/lib/wofbi-feedback-defaults.js`
   - Add a `testimony_title` short-text field in the "Your Testimony" section, placed just before the existing `testimony` long-text field (label: "Testimony Title", placeholder e.g. "Give your testimony a title").

2. `src/components/exams/CourseReportTab.jsx` (autofill, ~line 496-507)
   - When collecting striking testimonies from feedback responses, use `answers.testimony_title` as the `heading` when present, falling back to the current `DEFAULT_TESTIMONY_HEADING`.

## Notes
- Existing tenants with a saved custom feedback form keep their current fields; they can add the new field via the feedback form editor (the field is only a default for new/reset forms). If you'd like existing saved forms auto-upgraded with the title field, say so and I'll include a migration/merge step.
- No database schema change needed — answers are stored as JSON.
