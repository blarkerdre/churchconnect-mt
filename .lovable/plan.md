

## Control Exam Result Visibility and Retake Permissions

### Summary
Three changes to how exam results are handled:
1. **Retake requires admin permission** — members can only retake a failed exam when an admin explicitly enables `retake_allowed` on the attempt (current behavior is correct, the edge function does NOT auto-set it).
2. **Hide scores, certificates, and Statement of Result** when email notification toggles are OFF — the `send_result_email` and `send_certificate_email` flags on each course will also control in-app visibility, not just email delivery.
3. **Pass/fail notification only on completion** — this already works as designed; no change needed.

### Implementation

#### 1. MemberExamsView — `src/pages/ExamManagement.jsx`
- **Hide scores on subject buttons** when `course.send_result_email === false`: show "✓ Completed" instead of "✓ 8/10"
- **Hide aggregate percentage** in progress text when `send_result_email` is false
- **Hide the grade badge** (Pass/Fail/Distinction) when `send_result_email` is false
- **Hide the Statement of Result button** when `send_result_email` is false
- **Retake logic** stays as-is: retake only allowed when `retake_allowed === true` on an attempt (admin must toggle this manually)

#### 2. MyCertificates — `src/components/certificates/MyCertificates.jsx`
- Accept a `hiddenCourseNames` prop (list of course names where `send_certificate_email` is false)
- Filter out completions whose `training_type` matches a hidden course name
- In `MyProfile.jsx`, fetch `exam_titles` to determine which courses have `send_certificate_email === false` and pass that list down

#### 3. MyProfile Exam Section — `src/pages/MyProfile.jsx`
- Fetch `exam_titles` for the tenant to get `send_certificate_email` flags
- Pass `hiddenCourseNames` to `MyCertificates`

#### 4. Edge Function — No changes needed
The `grade-exam` function already respects the email toggles for sending emails. The retake flow already requires `retake_allowed` to be true (set by admin). No edge function changes required.

### Files changed
- **Edit**: `src/pages/ExamManagement.jsx` — conditionally hide scores, grade badge, and statement based on course email flags
- **Edit**: `src/components/certificates/MyCertificates.jsx` — filter out certificates for courses with notifications off
- **Edit**: `src/pages/MyProfile.jsx` — fetch course flags, pass to MyCertificates

