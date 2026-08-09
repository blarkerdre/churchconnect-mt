# Rename statement bulk download labels and files

The bulk buttons in Bible School course results are currently labelled just "Merged PDF" and "ZIP", which doesn't say what they contain, and the downloaded file names are generic.

## Changes

1. Button labels (course results toolbar)
   - "Merged PDF" becomes "Statements PDF"
   - "ZIP" becomes "Statements ZIP"

2. Downloaded file names
   - Merged file: `statement-of-result-merged.pdf`
   - ZIP file: `statements-of-result.zip`
   - Stored object name follows the same wording instead of the current generic `-statements` suffix.

3. Toast wording
   - "Merged PDF ready" becomes "Statements of Result PDF ready"
   - "ZIP ready" becomes "Statements of Result ZIP ready"

## Technical details

- `src/components/exams/CourseResultsView.jsx`: update the two statement bulk buttons' labels and the completion toast titles.
- `supabase/functions/render-statements-bulk/index.ts`: change the storage path suffix and the signed-URL `download` parameter to the new names (redeploy required).
