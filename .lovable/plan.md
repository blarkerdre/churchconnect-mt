## Problem
The Bible School certificate template with the custom background currently only matches **Basic Certificate Course (BCC)**. **Leadership Certificate Course (LCC)** and **Leadership Diploma Course (LDC)** have no matching template rows, so they would fall back to the generic "Default" layout (or a plain design) instead of using the same certificate background.

## Solution
Create two new `certificate_templates` records — one for LCC and one for LDC — that reuse the exact same background image, church name, signatory, colors, text positions, and styling as the existing BCC template. No code changes are required; the `issue-certificate` Edge Function already looks up templates by exact `training_type` match.

## Steps
1. **Read the full BCC template** from `certificate_templates` to capture all field values.
2. **Insert two new rows**:
   - `training_type`: `"Leadership Certificate Course (LCC)"` — all other fields copied from BCC
   - `training_type`: `"Leadership Diploma Course (LDC)"` — all other fields copied from BCC
3. **Verify** the records appear in the Certificate Template Settings UI and that preview/issue works for all three courses.

## Outcome
All Bible School courses (BCC, LCC, LDC) will generate certificates using the same uploaded background with student-specific text overlaid.